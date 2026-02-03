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
    const { pdfContent } = await req.json();

    if (!pdfContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF content is required' }),
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

    console.log('Processing PDF content, length:', pdfContent.length);

    const systemPrompt = `You are a recipe extraction expert. You will be given text extracted from a PDF cookbook.
Your job is to identify and extract individual recipes from this text.

For each recipe found, extract:
1. Recipe name/title
2. Number of servings
3. Nutrition facts per serving:
   - calories
   - protein (in grams)
   - carbs (in grams)
   - fat (in grams)
   - fiber (in grams, if available)
4. Ingredients list (as an array of strings)
5. Raw ingredients text (the original text format)
6. Cooking instructions

IMPORTANT:
- Extract ALL recipes you can identify from the text
- If nutrition info is missing, estimate reasonable values based on the ingredients
- If servings aren't specified, estimate based on recipe type (typically 4-6 for main dishes)
- Clean up ingredient formatting but preserve quantities and measurements
- Keep instructions in a readable format with step numbers`;

    const userPrompt = `Extract all recipes from this cookbook PDF content. Return the recipes as a JSON array.

PDF Content:
${pdfContent}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_recipes',
              description: 'Extract recipes from cookbook text and return structured data',
              parameters: {
                type: 'object',
                properties: {
                  recipes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Recipe name/title' },
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
                          description: 'List of ingredients',
                        },
                        ingredientsRaw: { type: 'string', description: 'Raw ingredients text' },
                        instructions: { type: 'string', description: 'Cooking instructions' },
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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process PDF with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_recipes') {
      console.error('Unexpected AI response format:', JSON.stringify(aiResponse));
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract recipes from PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let recipes: ExtractedRecipe[];
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      recipes = parsed.recipes || [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse extracted recipes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully extracted ${recipes.length} recipes`);

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
