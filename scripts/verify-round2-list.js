#!/usr/bin/env node

/**
 * Verify Round 2 list was created successfully
 */

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function verifyList(listId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contactslist/${listId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const list = response.data.Data[0];

    console.log('✅ ROUND 2 LIST VERIFICATION');
    console.log('='.repeat(80));
    console.log(`List ID: ${list.ID}`);
    console.log(`List Name: ${list.Name}`);
    console.log(`Subscriber Count: ${list.SubscriberCount}`);
    console.log(`Status: ${list.SubscriberCount === 1000 ? '✅ PERFECT' : '⚠️ Check count'}`);
    console.log(`\n${list.SubscriberCount === 1000 ? '🚀 Ready for campaign launch!' : '⏳ Wait for MailJet to finish processing...'}`);

    return list;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

verifyList(10503118).catch(console.error);