import { Client, Databases, ID, Query, Users } from 'node-appwrite';
import { Resend } from 'resend';

// This Appwrite function will send social media verification codes
export default async ({ req, res, log, error }) => {
  console.log('🚀 Social media code sending function started');
  console.log('📋 Request details:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    payload: req.payload
  });

  let userData;

  try {
    // Appwrite parses the body automatically if Content-Type is application/json.
    // If not, the raw payload is in req.payload. We handle both.
    const body = (req.body && Object.keys(req.body).length > 0) 
      ? req.body 
      : JSON.parse(req.payload || '{}');
      
    userData = body;

    console.log('👤 Extracted user data:', userData);

    if (!userData || !userData.userId) {
      console.error('❌ Validation failed: User data not found in request');
      error('Validation failed: User data not found in request body or payload.');
      return res.json({ ok: false, message: 'User data is required.' }, 400);
    }
  } catch (e) {
    console.error('❌ Failed to parse request body/payload:', e);
    error('Failed to parse request body/payload.', e);
    return res.json({ ok: false, message: 'Invalid request format.' }, 400);
  }
  
  console.log('🔧 Setting up Appwrite client...');
  
  // Setup Appwrite client
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);

  console.log('📧 Setting up Resend client...');
  
  // Setup Resend client
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log('🔍 Step 1: Getting user details...');
    
    // Get user details from Appwrite
    const user = await users.get(userData.userId);

    console.log('✅ User found:', {
      userId: user.$id,
      email: user.email,
      name: user.name
    });

    console.log('🔍 Step 2: Getting user document for social media info...');
    
    // Get user document to get social media information
    const userDocs = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_USER_COLLECTION_ID,
      [Query.equal('creatoraccountid', userData.userId)]
    );

    if (userDocs.documents.length === 0) {
      console.error('❌ User document not found');
      error('User document not found in database.');
      return res.json({ ok: false, message: 'User document not found.' }, 404);
    }

    const userDoc = userDocs.documents[0];
    const socialMedia = userData.socialMedia || userDoc.social_media;
    const socialMediaUsername = userData.socialMediaUsername || userDoc.social_media_username;
    
    // Generate a new 6-digit code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('🔢 Generated new verification code:', newCode);

    console.log('💾 Step 3: Updating user document with new code...');
    
    // Update the user document with the new code
    await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_USER_COLLECTION_ID,
      userDoc.$id,
      {
        social_media_number: newCode,
        social_media_number_correct: false // Reset verification status
      }
    );

    console.log('✅ User document updated with new code');

    console.log('📧 Step 4: Sending verification code email...');
    
         // Send the verification code email using Resend
     const emailResult = await resend.emails.send({
       from: 'verification@email.cherrizbox.com',
       to: 'yannsalvignol@gmail.com',
       subject: `Social Media Verification Code - ${socialMedia}`,
       html: `
         <p><strong>Cherrizbox - Social Media Verification Code</strong></p>
         <p>User: ${user.name || 'Unknown'} (${user.email})</p>
         <p>Platform: ${socialMedia}</p>
         <p>Username: @${socialMediaUsername}</p>
         <p><strong>Verification Code: ${newCode}</strong></p>
         <p>This code was requested by the user for social media verification.</p>
       `,
     });

    console.log('✅ Verification code email sent successfully:', {
      emailId: emailResult.id,
      to: 'yannsalvignol@gmail.com',
      subject: `Your Cherrizbox Verification Code - ${socialMedia}`,
      code: newCode
    });
    
    console.log('🎉 Social media code sending process completed successfully!');
    return res.json({ 
      ok: true, 
      message: 'Verification code sent successfully',
      code: newCode // For debugging purposes
    });

  } catch (e) {
    console.error('💥 FATAL: An exception occurred during social media code sending:', {
      error: e.message,
      stack: e.stack,
      userData: userData
    });
    error('FATAL: An exception occurred during social media code sending:', e);
    // Return a generic error to the client
    return res.json({ ok: false, message: 'An internal server error occurred.' }, 500);
  }
};
