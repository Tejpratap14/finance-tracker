import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // High-fidelity Mock Fallback for local testing/demo without API Key
      console.log('No ANTHROPIC_API_KEY found. Using high-fidelity Indian receipt mock fallback.');
      
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockMerchants = [
        { name: 'Starbucks Coffee', category: 'Food/Beverages', gstRate: 5, amount: 480.00, gstin: '07AAACS1024F1Z3' },
        { name: 'Uber India', category: 'Travel', gstRate: 5, amount: 650.00, gstin: '27AABCU1839C1Z0' },
        { name: 'Amazon Web Services', category: 'Software/SaaS', gstRate: 18, amount: 12400.00, gstin: '9917USA29003OSG' },
        { name: 'Blue Tokai Coffee Roasters', category: 'Food/Beverages', gstRate: 5, amount: 350.00, gstin: '07AABCB9122K1Z9' },
        { name: 'Shell Fuel Station', category: 'Fuel', gstRate: 0, amount: 2500.00, gstin: null },
        { name: 'Tally Solutions Pvt Ltd', category: 'Software/SaaS', gstRate: 18, amount: 22500.00, gstin: '29AAACT1940E1ZP' }
      ];

      const randomIndex = Math.floor(Math.random() * mockMerchants.length);
      const merchant = mockMerchants[randomIndex];
      
      const totalAmount = merchant.amount;
      const rate = merchant.gstRate;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (rate > 0) {
        // Simple back-calculation: baseAmount = totalAmount / (1 + rate/100)
        const baseAmount = totalAmount / (1 + rate / 100);
        const totalGst = totalAmount - baseAmount;
        
        if (merchant.gstin && merchant.gstin.startsWith('07')) {
          // Intra-state for Delhi (assuming user state is Delhi)
          cgst = Math.round((totalGst / 2) * 100) / 100;
          sgst = Math.round((totalGst / 2) * 100) / 100;
        } else if (merchant.gstin) {
          // Inter-state
          igst = Math.round(totalGst * 100) / 100;
        } else {
          cgst = Math.round((totalGst / 2) * 100) / 100;
          sgst = Math.round((totalGst / 2) * 100) / 100;
        }
      }

      // Today's date formatted as YYYY-MM-DD
      const dateStr = new Date().toISOString().split('T')[0];

      return NextResponse.json({
        merchantName: merchant.name,
        date: dateStr,
        amount: totalAmount.toString(),
        category: merchant.category,
        gstRate: rate.toString(),
        cgst: cgst.toString(),
        sgst: sgst.toString(),
        igst: igst.toString(),
        merchantGstin: merchant.gstin,
        notes: 'AI-Extracted (Mock Fallback Mode)',
      });
    }

    // Call Claude Messages API with Vision
    console.log('Sending receipt image to Claude API for OCR extraction...');
    
    // 1. Download image from Supabase Storage and convert to base64
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 2. Prepare message for Claude
    const prompt = `
Analyze the attached receipt image and extract the following details as a valid JSON object. 
You must respond ONLY with the JSON object. Do not include markdown code block syntax (like \`\`\`json) or any conversational text.

Ensure you extract/calculate:
1. "merchantName": The name of the shop, vendor, or business.
2. "date": The transaction date in YYYY-MM-DD format. If not found, use current date.
3. "amount": The total amount of the invoice/receipt as a decimal number.
4. "category": Choose the best matching category from: "Food/Beverages", "Travel", "Supplies", "Fuel", "Software/SaaS", "Services", "Others".
5. "gstRate": If there is GST mentioned, specify the percentage rate (e.g. 5, 12, 18, 28) as a number. Default to 0 if not found.
6. "cgst": The Central GST amount as a number, if itemized on the receipt.
7. "sgst": The State/UT GST amount as a number, if itemized.
8. "igst": The Integrated GST amount as a number, if itemized.
9. "merchantGstin": The 15-character GSTIN identifier of the merchant (e.g., 07AAAAA1111A1Z1). Ensure it matches Indian GSTIN pattern: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit, 1 character, 1 digit. Return null if not present.
10. "notes": A brief 1-sentence summary of items purchased.

Response JSON Schema:
{
  "merchantName": "...",
  "date": "YYYY-MM-DD",
  "amount": number,
  "category": "...",
  "gstRate": number,
  "cgst": number,
  "sgst": number,
  "igst": number,
  "merchantGstin": "..." or null,
  "notes": "..."
}
`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: contentType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude API error response:', errText);
      throw new Error(`Claude API returned status ${claudeResponse.status}`);
    }

    const claudeResult = await claudeResponse.json();
    const responseText = claudeResult.content[0].text.trim();
    
    // Clean up response if Claude accidentally wrapped it in code blocks
    let cleanedText = responseText;
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```$/, '');
    }
    
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({
      merchantName: parsedData.merchantName || 'Unknown Merchant',
      date: parsedData.date || new Date().toISOString().split('T')[0],
      amount: (parsedData.amount || 0).toString(),
      category: parsedData.category || 'Others',
      gstRate: (parsedData.gstRate || 0).toString(),
      cgst: (parsedData.cgst || 0).toString(),
      sgst: (parsedData.sgst || 0).toString(),
      igst: (parsedData.igst || 0).toString(),
      merchantGstin: parsedData.merchantGstin || null,
      notes: parsedData.notes || 'AI-Extracted',
    });

  } catch (error: any) {
    console.error('OCR Extraction error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze receipt' }, { status: 500 });
  }
}
