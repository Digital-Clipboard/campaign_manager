#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function getAllContactsFromList(listId) {
  let allContacts = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/listrecipient?ContactsList=${listId}&Limit=${limit}&Offset=${offset}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const contacts = response.data.Data;
    allContacts = allContacts.concat(contacts);
    
    console.log(`   Fetched ${contacts.length} contacts (total so far: ${allContacts.length})`);

    if (contacts.length < limit) break;
    offset += limit;
  }

  return allContacts;
}

async function addContactsToList(listId, contacts) {
  const batchSize = 100;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const contactsPayload = batch.map(c => ({ ContactID: c.ContactID }));

    console.log(`   Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contacts.length / batchSize)} (${batch.length} contacts)...`);

    try {
      const response = await axios.post(
        `https://api.mailjet.com/v3/REST/contactslist/${listId}/managemanycontacts`,
        {
          Action: 'addnoforce',
          Contacts: contactsPayload
        },
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`   ✅ Batch uploaded. Job ID: ${response.data.Data[0]?.JobID || 'N/A'}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Error uploading batch: ${error.response?.data?.ErrorMessage || error.message}`);
    }
  }
}

async function uploadRound2Contacts() {
  console.log('📤 Uploading contacts to Round 2 list (campaign_batch_002)');
  console.log('='.repeat(80));

  // Step 1: Fetch all contacts from master list
  console.log('Step 1: Fetching contacts from master list...');
  const allContacts = await getAllContactsFromList(5776);
  console.log(`✅ Total contacts fetched: ${allContacts.length}`);

  // Step 2: Sort by Contact ID
  console.log('\nStep 2: Sorting contacts by Contact ID...');
  allContacts.sort((a, b) => a.ContactID - b.ContactID);

  // Step 3: Extract users 1,001-2,000
  console.log('\nStep 3: Extracting users 1,001-2,000...');
  const round2Contacts = allContacts.slice(1000, 2000);
  console.log(`   ✅ Extracted ${round2Contacts.length} contacts for Round 2`);
  console.log(`   First Contact ID: ${round2Contacts[0].ContactID}`);
  console.log(`   Last Contact ID: ${round2Contacts[round2Contacts.length - 1].ContactID}`);

  // Step 4: Upload to list 10503118
  console.log('\nStep 4: Uploading contacts to list 10503118...');
  await addContactsToList(10503118, round2Contacts);

  console.log('\n✅ UPLOAD COMPLETE!');
  console.log('⏳ Wait 1-2 minutes for MailJet to process the contacts asynchronously');
  console.log('   Then run: node scripts/verify-round2-list.js');
}

uploadRound2Contacts().catch(console.error);
