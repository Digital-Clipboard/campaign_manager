#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

const failedContactIds = [
  125561873,
  1049601042,
  1049601222,
  1049601400,
  1049601643,
  1049602266,
  1049602317,
  1049602468
];

async function getContactEmail(contactId) {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contact/${contactId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      ContactID: response.data.Data[0].ID,
      Email: response.data.Data[0].Email
    };
    
  } catch (error) {
    console.error(`   ⚠️ Error fetching contact ${contactId}: ${error.message}`);
    return null;
  }
}

async function uploadMissingContacts() {
  console.log('📤 Uploading 8 missing contacts to Round 2 list');
  console.log('='.repeat(80));

  console.log('Step 1: Fetching email addresses for failed contacts...');
  const contacts = [];
  
  for (const contactId of failedContactIds) {
    console.log(`   Fetching contact ${contactId}...`);
    const contact = await getContactEmail(contactId);
    if (contact) {
      contacts.push(contact);
      console.log(`   ✅ Got email: ${contact.Email}`);
    }
  }
  
  console.log(`\n✅ Retrieved ${contacts.length} contacts with emails`);

  if (contacts.length === 0) {
    console.log('❌ No contacts to upload');
    return;
  }

  console.log('\nStep 2: Uploading to list 10503118...');
  
  try {
    const response = await axios.post(
      'https://api.mailjet.com/v3/REST/contactslist/10503118/managemanycontacts',
      {
        Action: 'addnoforce',
        Contacts: contacts.map(c => ({ Email: c.Email }))
      },
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Upload complete. Job ID: ${response.data.Data[0]?.JobID || 'N/A'}`);
    console.log('\n⏳ Wait 1 minute then run: node scripts/verify-round2-list.js');
    
  } catch (error) {
    console.error(`❌ Error uploading: ${error.response?.data?.ErrorMessage || error.message}`);
  }
}

uploadMissingContacts().catch(console.error);
