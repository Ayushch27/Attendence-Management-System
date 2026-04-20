const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    console.log('Database already seeded. To re-seed, drop the database first.');
    return;
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create an Admin
  await prisma.user.create({
    data: { name: 'Super Admin', role: 'ADMIN', email: 'admin@gmail.com', password: hashedPassword }
  });

  // Create Teacher
  const teacher = await prisma.user.create({
    data: { name: 'Dr. Smith', role: 'TEACHER', email: 'smith@school.edu', password: hashedPassword }
  });

  // Create Students
  const students = await Promise.all([
    prisma.user.create({ data: { name: 'Alice Cooper', role: 'STUDENT', email: 'alice@school.edu', password: hashedPassword } }),
    prisma.user.create({ data: { name: 'Bob Marley', role: 'STUDENT', email: 'bob@school.edu', password: hashedPassword } }),
    prisma.user.create({ data: { name: 'Charlie Puth', role: 'STUDENT', email: 'charlie@school.edu', password: hashedPassword } }),
    prisma.user.create({ data: { name: 'Diana Ross', role: 'STUDENT', email: 'diana@school.edu', password: hashedPassword } })
  ]);

  const session = await prisma.classSession.create({
    data: { name: 'CS 101 - Intro to Programming' }
  });

  const recordsData = students.map(s => ({
    studentId: s.id,
    sessionId: session.id,
    isPresent: false
  }));

  await prisma.attendanceRecord.createMany({ data: recordsData });

  console.log('Seed created successfully! Admin: admin@gmail.com, Teacher: smith@school.edu, Password: password123');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
