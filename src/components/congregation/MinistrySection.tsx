"use client";

import { Users, UserCheck, Target, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Congregation } from "@/lib/db/congregations";

interface MinistrySectionProps {
  congregationData: Congregation;
  userId?: string | null;
}

export function MinistrySection({ congregationData, userId }: MinistrySectionProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ministry Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Active Publishers</span>
              </div>
              <div className="pl-6">
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-muted-foreground">Total publishers</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Service Hours</span>
              </div>
              <div className="pl-6">
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-muted-foreground">This month</div>
              </div>
            </div>
          </div>
          
          {congregationData.business_witnessing_enabled && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Badge variant="outline" className="text-xs">
                Business Witnessing Enabled
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Bible Studies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active Bible studies</p>
            <p className="text-sm">Bible studies will appear here when added</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ministry Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No assignments available</p>
            <p className="text-sm">Ministry assignments will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
