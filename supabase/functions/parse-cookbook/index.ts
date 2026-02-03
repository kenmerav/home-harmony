import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ExtractedRecipe {
  name: string;
  servings: number;
  macrosPerServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
  ingredients: string[];
  ingredientsRaw: string;
  instructions: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing PDF:', fileName, 'Base64 length:', pdfBase64.length);

    const systemPrompt = `You are an expert at extracting recipes from cookbook PDFs. 
Analyze the provided PDF document and extract ALL recipes you can find.

For each recipe, extract:
1. Recipe name/title (exact name from the document)
2. Number of servings (if not specified, estimate 4-6 for main dishes)
3. Nutrition facts per serving (if available):
   - calories
   - protein (in grams)
   - carbs (in grams)  
   - fat (in grams)
   - fiber (in grams, optional)
4. Complete ingredients list with quantities
5. Step-by-step cooking instructions

CRITICAL INSTRUCTIONS:
- Extract EVERY recipe from the PDF, not just a few
- Use the EXACT recipe names from the document
- If nutrition info is not provided, make reasonable estimates based on ingredients
- Include ALL ingredients with their measurements
- Preserve the original instruction steps`;

    const userPrompt = `Please analyze this cookbook PDF and extract ALL recipes. Return them in the structured format requested.`;

    // Use Gemini's document understanding capability
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'file',
                file: {
                  filename: fileName || 'cookbook.pdf',
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_recipes',
              description: 'Extract all recipes from the cookbook PDF',
              parameters: {
                type: 'object',
                properties: {
                  recipes: {
                    type: 'array',
                    description: 'All recipes extracted from the PDF',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Exact recipe name from the document' },
                        servings: { type: 'number', description: 'Number of servings' },
                        macrosPerServing: {
                          type: 'object',
                          properties: {
                            calories: { type: 'number' },
                            protein_g: { type: 'number' },
                            carbs_g: { type: 'number' },
                            fat_g: { type: 'number' },
                            fiber_g: { type: 'number' },
                          },
                          required: ['calories', 'protein_g', 'carbs_g', 'fat_g'],
                        },
                        ingredients: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'List of ingredients with quantities',
                        },
                        ingredientsRaw: { type: 'string', description: 'Raw ingredients text' },
                        instructions: { type: 'string', description: 'Full cooking instructions' },
                      },
                      required: ['name', 'servings', 'macrosPerServing', 'ingredients', 'ingredientsRaw', 'instructions'],
                    },
                  },
                },
                required: ['recipes'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_recipes' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `AI processing failed: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI response received, choices:', aiResponse.choices?.length);

    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_recipes') {
      // Try to get content directly if tool call failed
      const content = aiResponse.choices?.[0]?.message?.content;
      console.error('No tool call in response. Content:', content?.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract recipes from PDF. The AI could not parse the document structure.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let recipes: ExtractedRecipe[];
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      recipes = parsed.recipes || [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Arguments:', toolCall.function.arguments?.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse extracted recipes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully extracted ${recipes.length} recipes`);
    
    // Log recipe names for debugging
    recipes.forEach((r, i) => console.log(`  ${i + 1}. ${r.name}`));

    return new Response(
      JSON.stringify({ success: true, recipes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing cookbook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
