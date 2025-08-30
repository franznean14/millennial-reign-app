"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, MapPin, Building2, MapPinned, Calendar, Users } from "lucide-react";
import { type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";

interface EstablishmentDetailsProps {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
  onBackClick: () => void;
}

export function EstablishmentDetails({ 
  establishment, 
  visits, 
  householders, 
  onBackClick 
}: EstablishmentDetailsProps) {
  const formatStatusText = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'for_follow_up':
        return 'border-orange-500/50 bg-orange-500/5';
      case 'has_bible_studies':
        return 'border-green-500/50 bg-green-500/5';
      case 'accepted_rack':
        return 'border-blue-500/50 bg-blue-500/5';
      case 'declined_rack':
        return 'border-red-500/50 bg-red-500/5';
      default:
        return 'border-gray-500/50 bg-gray-500/5';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'for_follow_up':
        return 'text-orange-500 border-orange-500/50';
      case 'has_bible_studies':
        return 'text-green-500 border-green-500/50';
      case 'accepted_rack':
        return 'text-blue-500 border-blue-500/50';
      case 'declined_rack':
        return 'text-red-500 border-red-500/50';
      default:
        return 'text-gray-500 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header with back button */}
      <motion.div 
        layout
        className="flex items-center gap-4 w-full"
        transition={{ 
          layout: { 
            type: "spring", 
            stiffness: 300, 
            damping: 30 
          }
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackClick}
          className="p-2 flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <motion.div layout className="min-w-0 flex-1">
          <motion.h1 
            layout 
            className="text-2xl font-bold truncate"
            transition={{ 
              layout: { 
                type: "spring", 
                stiffness: 300, 
                damping: 30 
              }
            }}
          >
            {establishment.name}
          </motion.h1>
          <motion.p 
            layout 
            className="text-muted-foreground truncate"
            transition={{ 
              layout: { 
                type: "spring", 
                stiffness: 300, 
                damping: 30 
              }
            }}
          >
            {establishment.area || 'No area specified'}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Basic Establishment Info with Direction Button */}
      <motion.div layout className="w-full">
        <Card className={cn("w-full", getStatusColor(establishment.status))}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 flex-shrink-0" />
              Establishment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge 
                  variant="outline" 
                  className={cn("flex-shrink-0", getStatusTextColor(establishment.status))}
                >
                  {establishment.status ? formatStatusText(establishment.status) : 'Unknown'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Floor</p>
                <p>{establishment.floor || 'Not specified'}</p>
              </div>
            </div>
            {establishment.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="break-words">{establishment.description}</p>
              </div>
            )}
            {establishment.lat && establishment.lng && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="break-all">{establishment.lat.toFixed(6)}, {establishment.lng.toFixed(6)}</span>
                  </p>
                  <a 
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted" 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.lat},${establishment.lng}`}
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    Directions
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Updates Section */}
      <motion.div layout className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 flex-shrink-0" />
              Visit Updates ({visits.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visits.length > 0 ? (
              <div className="space-y-3">
                {visits.map((visit) => {
                  console.log('Visit data:', visit); // Debug log
                  console.log('Publisher:', visit.publisher); // Debug publisher
                  console.log('Partner:', visit.partner); // Debug partner
                  return (
                    <div key={visit.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{formatDate(visit.visit_date)}</span>
                        </div>
                        {visit.note && (
                          <p className="text-sm text-muted-foreground">{visit.note}</p>
                        )}
                      </div>
                      
                      {/* Publisher avatars on the right - overlapping style */}
                      <div className="flex items-center flex-shrink-0">
                        {visit.publisher ? (
                          <Avatar className="h-8 w-8 ring-2 ring-background">
                            <AvatarImage src={visit.publisher.avatar_url} alt={`${visit.publisher.first_name} ${visit.publisher.last_name}`} />
                            <AvatarFallback className="text-xs">
                              {visit.publisher.first_name && visit.publisher.last_name ? 
                                `${visit.publisher.first_name} ${visit.publisher.last_name}`.charAt(0) : 
                                'U'
                              }
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="text-xs text-muted-foreground">No publisher</div>
                        )}
                        {visit.partner ? (
                          <Avatar className="h-8 w-8 -ml-2 ring-2 ring-background">
                            <AvatarImage src={visit.partner.avatar_url} alt={`${visit.partner.first_name} ${visit.partner.last_name}`} />
                            <AvatarFallback className="text-xs">
                              {visit.partner.first_name && visit.partner.last_name ? 
                                `${visit.partner.first_name} ${visit.partner.last_name}`.charAt(0) : 
                                'U'
                              }
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No visits recorded yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Householders Section */}
      <motion.div layout className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 flex-shrink-0" />
              Householders ({householders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {householders.length > 0 ? (
              <div className="space-y-3">
                {householders.map((householder) => (
                  <div key={householder.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{householder.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {householder.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Badge>
                        {householder.assigned_user && (
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={householder.assigned_user.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {`${householder.assigned_user.first_name} ${householder.assigned_user.last_name}`.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {householder.assigned_user.first_name} {householder.assigned_user.last_name}
                            </span>
                          </div>
                        )}
                      </div>
                      {householder.note && (
                        <p className="text-sm text-muted-foreground">{householder.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No householders recorded yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
