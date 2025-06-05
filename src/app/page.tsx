import { Header } from "@/components/layout/Header";
import InteractiveMap from "@/components/map/InteractiveMap"; // Dynamically import client component
import { ShadcnDemoElements } from "@/components/demo/ShadcnDemoElements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="font-headline text-4xl font-bold mb-2">Welcome to Elemental</h1>
          <p className="text-lg text-muted-foreground">
            Explore an interactive world and experience beautifully crafted UI components.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            This application is built with Next.js, OpenLayers, ShadCN UI, and Tailwind CSS.
            Genkit is integrated for future AI capabilities.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <section aria-labelledby="map-section-title" className="lg:w-2/3">
            <Card className="h-full shadow-xl">
              <CardHeader>
                <CardTitle id="map-section-title" className="font-headline text-2xl">Interactive Map</CardTitle>
                <CardDescription>Powered by OpenLayers</CardDescription>
              </CardHeader>
              <CardContent className="h-[500px] lg:h-[600px] p-0"> {/* Map needs explicit height for its container */}
                <InteractiveMap />
              </CardContent>
            </Card>
          </section>

          <aside aria-labelledby="ui-showcase-title" className="lg:w-1/3">
             <ShadcnDemoElements />
          </aside>
        </div>

        <section aria-labelledby="genkit-info-title" className="mt-12">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle id="genkit-info-title" className="font-headline text-2xl">GenAI Integration</CardTitle>
                    <CardDescription>Powered by Genkit</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        This application is prepared for AI-powered features using Genkit.
                        An example flow <code className="font-code bg-muted p-1 rounded-sm text-sm">generateStartingPoints</code> is available in <code className="font-code bg-muted p-1 rounded-sm text-sm">src/ai/flows/</code>,
                        demonstrating how to generate map locations based on a prompt.
                    </p>
                    <pre className="font-code bg-muted p-4 rounded-md text-sm overflow-x-auto">
                        <code>
{`// src/ai/flows/generate-starting-points.ts
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ... (schema definitions)

export async function generateStartingPoints(input: GenerateStartingPointsInput): Promise<GenerateStartingPointsOutput> {
  // ... (flow logic)
}`}
                        </code>
                    </pre>
                </CardContent>
            </Card>
        </section>

      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} Elemental. All rights reserved.</p>
      </footer>
    </div>
  );
}
