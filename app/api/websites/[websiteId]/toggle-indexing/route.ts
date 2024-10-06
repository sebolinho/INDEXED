// app/api/websites/[websiteId]/toggle-indexing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWebsiteById, updateWebsite } from '@/models';
import { withErrorHandling } from '@/utils/apiUtils';
import { AuthenticationError, NotFoundError, ValidationError } from '@/utils/errors';
import jobQueue from '@/lib/jobQueue';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new AuthenticationError('Unauthorized');
  }

  const websiteId = parseInt(request.url.split('/').slice(-2)[0]);

  if (isNaN(websiteId)) {
    throw new ValidationError('Invalid website ID');
  }

  const { website } = await getWebsiteById(websiteId);
  if (!website) {
    throw new NotFoundError('Website not found');
  }

  if (website.user_id !== parseInt(session.user.id)) {
    throw new AuthenticationError('You do not have permission to modify this website');
  }

  const body = await request.json();
  const { enabled } = body;

  if (typeof enabled !== 'boolean') {
    throw new ValidationError('Invalid input: enabled must be a boolean');
  }

  const isFirstTimeEnabled = !website.indexing_enabled && enabled;
  const { website: updatedWebsite } = await updateWebsite(websiteId, { indexing_enabled: enabled });

  let message = '';
  if (enabled) {
    message = 'Auto-indexing enabled.';
    if (isFirstTimeEnabled) {
      // If indexing is being enabled for the first time, start a background indexing job
      try {
        // Enqueue the job for processing the sitemap in the background
        await jobQueue.addJob(websiteId);
        message = 'Auto-indexing enabled. Fetching data from Google Search Console...';
      } catch (error) {
        console.error(`Failed to start indexing job for website ${websiteId}:`, error);
      }
    }
  }
  else {  
    message = 'Auto-indexing disabled.';
  }
  return NextResponse.json({ website: updatedWebsite, message });
});