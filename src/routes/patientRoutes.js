const express = require('express');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const authenticateToken = require('../authMiddleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const staffData= JSON.parse(fs.readFileSync(path.join(__dirname, 'staff.json'), 'utf-8'));

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user= staffData.find(u => u.email === email && u.password === password);

    
    if (user) {
        const token= jwt.sign({email: user.email, FirstName: user.FirstName, LastName: user.LastName}, process.env.ACCESS_TOKEN_SECRET);
            res.json({
                token, FirstName: user.FirstName, LastName: user.LastName
            }) 
    } else {
        res.status(400).send('Invalid email or password.');
    }
});

router.post('/logout', (req, res) => {
    res.status(200).send('Logged out successfully.');
});

router.post('/patients', async (req, res) => {
    try {
      const { FirstName, LastName, DateOfBirth, Gender, PhoneNumber, Address, Allergies, Prescriptions, Height, Weight, Notes, Diagnosis } = req.body;
  
      const request = new sql.Request();
  
      const result = await request.query('SELECT MAX(PatientId) AS maxId FROM Patient;');
      const maxId = result.recordset[0]?.maxId || 0; 
      const newId = maxId + 1;
  
      await request
      .input('PatientId', sql.Int, newId)
      .input('FirstName', sql.VarChar, FirstName)
      .input('LastName', sql.VarChar, LastName)
      .input('DateOfBirth', sql.Date, DateOfBirth)
      .input('Gender', sql.VarChar, Gender)
      .input('PhoneNumber', sql.VarChar, PhoneNumber)
      .input('Address', sql.VarChar, Address)
      .query(`
        INSERT INTO Patient (PatientId, FirstName, LastName, DateOfBirth, Gender, PhoneNumber, Address) 
        VALUES (@PatientId, @FirstName, @LastName, @DateOfBirth, @Gender, @PhoneNumber, @Address)
      `);
        
  
      await request
      .input('PatientRecordsId', sql.Int, newId)
      .input('Allergies', sql.VarChar, Allergies || null)
      .input('Prescriptions', sql.VarChar, Prescriptions || null)
      .input('Height', sql.Float, Height || null)
      .input('Weight', sql.Float, Weight || null)
      .input('Notes', sql.Text, Notes || null)
      .input('Diagnosis', sql.VarChar, Diagnosis || null)
      .query(`
        INSERT INTO PatientRecords (PatientRecordsId, PatientId, Allergies, Prescriptions, Height, Weight, Notes, Diagnosis) 
        VALUES (@PatientRecordsId, @PatientRecordsId, @Allergies, @Prescriptions, @Height, @Weight, @Notes, @Diagnosis)
      `);

      res.status(201).send(`Patient with ID ${newId} has been added to the database.`);
    } catch (err) {
      console.error('Error inserting patient data:', err);
      res.status(500).send('Failed to add patient to the database.');
    }
  });
  

router.get('/patients', async (req, res) => {
  try {
    const request = new sql.Request();
    const result = await request.query('SELECT * FROM Patient;');
    res.status(200).send(result.recordset);
  } catch (err) {
    res.status(400).send(console.error());
  }
});

router.get('/patients/search', async (req, res) => {
    try {
        const { FirstName, LastName } = req.query;
        const request = new sql.Request();

        console.log('Search Query:', { FirstName, LastName });

        const result = await request
            .input('FirstName', sql.VarChar, `%${FirstName}%`) // Add wildcards for partial matches
            .input('LastName', sql.VarChar, `%${LastName}%`)
            .query(`
                SELECT p.PatientId, p.FirstName, p.LastName, p.DateOfBirth, p.Gender, p.PhoneNumber, p.Address,
                       pr.PatientRecordsId, pr.Allergies, pr.Prescriptions, pr.Height, pr.Weight, pr.Notes, pr.Diagnosis
                FROM Patient p
                LEFT JOIN PatientRecords pr ON p.PatientId = pr.PatientId
                WHERE (@FirstName = '%%' OR p.FirstName LIKE @FirstName)
                  AND (@LastName = '%%' OR p.LastName LIKE @LastName);
            `);


        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching patient data:', err);
        res.status(500).send('Failed to fetch patient data.');
    }
});

router.get('/patients/:id', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT p.PatientId, p.FirstName, p.LastName, p.DateOfBirth, p.Gender, p.PhoneNumber, p.Address,
                   pr.PatientRecordsId, pr.Allergies, pr.Prescriptions, pr.Height, pr.Weight, pr.Notes, pr.Diagnosis
            FROM Patient p
            LEFT JOIN PatientRecords pr ON p.PatientId = pr.PatientId
            WHERE p.PatientId = ${req.params.id};
        `);
        if (result.recordset.length === 0) {
            return res.status(404).send('Patient not found');
        }
        res.status(200).send(result.recordset[0]);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.patch('/patients/:id', async (req, res) => {
    try {
        const {PatientId, Allergies, Prescriptions, Height, Weight, Notes, Diagnosis} = req.body;
        const request = new sql.Request();

        await request
        .input('PatientId', sql.Int, PatientId)
        .input('Allergies', sql.VarChar, Allergies || null)
        .input('Prescriptions', sql.VarChar, Prescriptions || null)
        .input('Height', sql.Float, Height || null)
        .input('Weight', sql.Float, Weight || null)
        .input('Notes', sql.Text, Notes || null)
        .input('Diagnosis', sql.VarChar, Diagnosis || null)
        .query(`
                UPDATE PatientRecords
                SET 
                    Allergies = @Allergies,
                    Prescriptions = @Prescriptions,
                    Height = @Height,
                    Weight = @Weight,
                    Notes = @Notes,
                    Diagnosis = @Diagnosis
                WHERE PatientId = @PatientId;
            `);

        res.status(200).send(`Patient with ID ${req.params.id} has been updated.`);
    } catch (err) {
        console.error('Error updating patient record:', err);
        res.status(400).send('Failed to update patient record.');
    }
});

router.delete('/patients/:id', async (req, res) => {
    try {
        const patientId = req.params.id;
        const request = new sql.Request();

        await request
            .input('PatientId', sql.Int, req.params.id)
            .query(`
               DELETE FROM PatientRecords WHERE PatientRecordsID = @PatientId;
                DELETE FROM Patient WHERE PatientID = @PatientId;
            `);
        
        res.status(200).send(`Patient record with ID ${req.params.id} has been deleted.`);
    } catch (err) {
        console.error('Error deleting patient record:', err);
        res.status(400).send('Failed to delete patient record.');
    }
});

module.exports = router;
