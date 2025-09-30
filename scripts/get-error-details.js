#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function getErrorFile(jobId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/DATA/Batchjob/${jobId}/JSONError/application:json/LAST`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 ERROR DETAILS:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error fetching error file:', error.response?.data || error.message);
  }
}

getErrorFile(1070309282).catch(console.error);
