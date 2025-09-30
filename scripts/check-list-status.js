#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function checkListStatus() {
  try {
    // Check list details
    const listResponse = await axios.get(
      'https://api.mailjet.com/v3/REST/contactslist/10503118',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 LIST DETAILS:');
    console.log(JSON.stringify(listResponse.data.Data[0], null, 2));

    // Check list recipients
    const recipientsResponse = await axios.get(
      'https://api.mailjet.com/v3/REST/listrecipient?ContactsList=10503118&Limit=10',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n📊 RECIPIENTS:');
    console.log(`Total: ${recipientsResponse.data.Total}`);
    console.log(`Count: ${recipientsResponse.data.Count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkListStatus().catch(console.error);
