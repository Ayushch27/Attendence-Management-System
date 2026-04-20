const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRole, JWT_SECRET } = require('./middleware/authMiddleware');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

/* -------------------------------------
 *  AUTH ROUTES
 * ------------------------------------- */

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* -------------------------------------
 *  CORE TEACHER / ATTENDANCE ROUTES
 * ------------------------------------- */

// We protect these routes globally so any registered user can technically read classes (like Teacher or Admin)
app.get('/api/classes', verifyToken, async (req, res) => {
  const sessions = await prisma.classSession.findMany({
    orderBy: { date: 'desc' }
  });
  res.json(sessions);
});

app.get('/api/classes/:id/roster', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const session = await prisma.classSession.findUnique({
      where: { id },
      include: {
        records: {
          include: { student: true }
        }
      }
    });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    const roster = session.records.map(r => ({
      recordId: r.id,
      studentId: r.student.id,
      studentName: r.student.name,
      isPresent: r.isPresent
    }));
    
    res.json({ session: session.name, isCompleted: session.isCompleted, roster });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protect modifying routes to TEACHER specifically
app.post('/api/attendance/capture', verifyToken, requireRole('TEACHER'), async (req, res) => {
  const { sessionId, imageUrl } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  
  try {
    const aiServiceUrl = 'http://localhost:3002/internal/ai/process';
    fetch(aiServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, imageUrl })
    }).catch(e => console.error("Could not reach AI module", e));

    res.json({ status: "processing", message: "Image sent to AI module for processing" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The webhook might come from the internal AI service without a JWT. 
// For this MVP, we leave it open, but normally it'd use an API Key or internal IP restriction.
app.post('/api/attendance/webhook', async (req, res) => {
  const { sessionId, presentStudentIds } = req.body;
  if (!sessionId || !Array.isArray(presentStudentIds)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    await prisma.attendanceRecord.updateMany({
      where: { sessionId },
      data: { isPresent: false }
    });

    await prisma.attendanceRecord.updateMany({
      where: {
        sessionId,
        studentId: { in: presentStudentIds }
      },
      data: { isPresent: true }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/records/:recordId/toggle', verifyToken, requireRole('TEACHER'), async (req, res) => {
  const { recordId } = req.params;
  const { isPresent } = req.body;
  try {
    const record = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { isPresent }
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/classes/:id/complete', verifyToken, requireRole('TEACHER'), async (req, res) => {
  const { id } = req.params;
  try {
    const session = await prisma.classSession.update({
      where: { id },
      data: { isCompleted: true }
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* -------------------------------------
 *  ADMIN PORTAL ROUTES (Strictly Protected)
 * ------------------------------------- */

// Apply middleware to all admin routes
app.use('/api/admin', verifyToken, requireRole('ADMIN'));

app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalClasses = await prisma.classSession.count();
    
    // Calculate global attendance %
    const totalRecords = await prisma.attendanceRecord.count();
    const presentRecords = await prisma.attendanceRecord.count({ where: { isPresent: true } });
    
    const attendancePercentage = totalRecords > 0 
      ? Math.round((presentRecords / totalRecords) * 100) 
      : 0;

    res.json({ totalUsers, totalClasses, attendancePercentage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { role: 'asc' }
    });
    // Don't send back passwords
    const safeUsers = users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const { name, email, role, password } = req.body;
  
  if (!name || !email || !role || !password) return res.status(400).json({ error: 'Missing required fields' });
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, role, password: hashedPassword }
    });

    if (role === 'STUDENT') {
      const allSessions = await prisma.classSession.findMany();
      if (allSessions.length > 0) {
        const recordsData = allSessions.map(session => ({
          studentId: newUser.id,
          sessionId: session.id,
          isPresent: false
        }));
        await prisma.attendanceRecord.createMany({ data: recordsData });
      }
    }

    const { password: pw, ...safeUser } = newUser;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const userToDel = await prisma.user.findUnique({ where: { id } });
    if (userToDel && userToDel.email === 'admin@gmail.com') {
      return res.status(403).json({ error: 'System violation: Cannot delete the primary Super Admin account.' });
    }

    await prisma.attendanceRecord.deleteMany({ where: { studentId: id } });
    const deletedUser = await prisma.user.delete({ where: { id } });
    res.json(deletedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id/attendance', async (req, res) => {
  const { id } = req.params;
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: id, session: { isCompleted: true } },
      include: { session: true },
      orderBy: { session: { date: 'desc' } }
    });

    res.json({
      history: records.map(r => ({
        id: r.id,
        className: r.session.name,
        date: r.session.date,
        isPresent: r.isPresent
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/classes', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const newSession = await prisma.classSession.create({
      data: { name }
    });

    const students = await prisma.user.findMany({ where: { role: 'STUDENT' }});
    if (students.length > 0) {
      const recordsData = students.map(s => ({
        sessionId: newSession.id,
        studentId: s.id,
        isPresent: false
      }));
      await prisma.attendanceRecord.createMany({ data: recordsData });
    }

    res.json(newSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* -------------------------------------
 *  STUDENT PORTAL ROUTES (Strictly Protected)
 * ------------------------------------- */

app.get('/api/student/dashboard', verifyToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const studentId = req.user.id;
    
    const records = await prisma.attendanceRecord.findMany({
      where: { 
        studentId, 
        session: { isCompleted: true } 
      },
      include: {
        session: true
      },
      orderBy: {
        session: { date: 'desc' }
      }
    });

    const totalCompletedClasses = records.length;
    const presentCount = records.filter(r => r.isPresent).length;
    
    const percentage = totalCompletedClasses > 0 
      ? Math.round((presentCount / totalCompletedClasses) * 100) 
      : 0;

    res.json({
      percentage,
      totalClasses: totalCompletedClasses,
      history: records.map(r => ({
        id: r.id,
        className: r.session.name,
        date: r.session.date,
        isPresent: r.isPresent
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend API Gateway running on http://localhost:${PORT}`);
});
