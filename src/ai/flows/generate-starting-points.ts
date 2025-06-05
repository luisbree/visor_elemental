'use server';

/**
 * @fileOverview Generates initial map locations and descriptions based on a user prompt.
 *
 * - generateStartingPoints - A function that generates starting points for the map.
 * - GenerateStartingPointsInput - The input type for the generateStartingPoints function.
 * - GenerateStartingPointsOutput - The return type for the generateStartingPoints function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStartingPointsInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing a location or topic.'),
});
export type GenerateStartingPointsInput = z.infer<typeof GenerateStartingPointsInputSchema>;

const GenerateStartingPointsOutputSchema = z.array(z.object({
  locationName: z.string().describe('The name of the location.'),
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
  description: z.string().describe('A brief description of the location.'),
}));
export type GenerateStartingPointsOutput = z.infer<typeof GenerateStartingPointsOutputSchema>;

export async function generateStartingPoints(input: GenerateStartingPointsInput): Promise<GenerateStartingPointsOutput> {
  return generateStartingPointsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStartingPointsPrompt',
  input: {schema: GenerateStartingPointsInputSchema},
  output: {schema: GenerateStartingPointsOutputSchema},
  prompt: `You are a helpful map assistant. The user will provide you with a prompt, and you will generate a few starting points for a map based on that prompt.  Each starting point must have a location name, latitude, longitude, and a brief description.

User Prompt: {{{prompt}}}

Please return a JSON array of location objects.  Each location object must contain the following fields:
locationName: string
latitude: number
longitude: number
description: string`,
});

const generateStartingPointsFlow = ai.defineFlow(
  {
    name: 'generateStartingPointsFlow',
    inputSchema: GenerateStartingPointsInputSchema,
    outputSchema: GenerateStartingPointsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
