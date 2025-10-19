"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UpcomingEvents() {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming events scheduled</p>
            <p className="text-sm">Events will appear here when added</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
