const express = require('express');
const app = express();

app.use(express.json());

// In a real system, the AI might query the database for enrolled students' vectors directly 
// or receive them in the payload. We'll simply mock a success response.
app.post('/internal/ai/process', (req, res) => {
  const { sessionId, imageUrl } = req.body;
  
  console.log(`[AI-Module] Received image for session ${sessionId}. Simulating processing...`);
  
  // Acknowledge receipt to the Event Bus / Caller
  res.status(202).json({ status: "Processing started" });

  // Simulate AI face detection taking 3 seconds
  setTimeout(async () => {
    try {
      // For this mock, we will grab the full roster from the backend API,
      // and randomly mark 2/3 of the class as "Present" to simulate matched faces.
      const rosterResponse = await fetch(`http://localhost:3001/api/classes/${sessionId}/roster`);
      const rosterData = await rosterResponse.json();
      
      const students = rosterData.roster;
      // Randomly pick a few students as present (whitelist)
      const presentStudentIds = students
        .filter(() => Math.random() > 0.3) 
        .map(s => s.studentId);
      
      console.log(`[AI-Module] Processing complete. Identified ${presentStudentIds.length} faces.`);

      // Publish results via webhook back to the Backend Service
      const webhookUrl = 'http://localhost:3001/api/attendance/webhook';
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          presentStudentIds
        })
      });
      console.log('[AI-Module] Sent results webhook back to core service.');
      
    } catch (err) {
      console.error('[AI-Module] Error during processing task:', err.message);
    }
  }, 3000);
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`AI Mock microservice running on http://localhost:${PORT}`);
});
