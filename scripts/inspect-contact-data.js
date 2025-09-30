#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function inspectContactData() {
  try {
    const response = await axios.get(
      'https://api.mailjet.com/v3/REST/listrecipient?ContactsList=5776&Limit=5',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 SAMPLE CONTACT DATA:');
    console.log(JSON.stringify(response.data.Data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

inspectContactData().catch(console.error);
