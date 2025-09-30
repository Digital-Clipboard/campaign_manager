#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function checkJobStatus(jobId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contactslist/10503118/managemanycontacts/${jobId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📊 JOB STATUS:');
    console.log(JSON.stringify(response.data.Data[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Check the last batch job
checkJobStatus(1070309282).catch(console.error);
