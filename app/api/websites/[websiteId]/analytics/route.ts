import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWebsiteById } from '@/models';
import { getPageImpressionsAndClicks } from '@/lib/googleSearchConsole';
import { getValidAccessToken } from '@/lib/tokenManager';
import { withErrorHandling } from '@/utils/apiUtils';
import { AuthenticationError, NotFoundError, ValidationError } from '@/utils/errors';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new AuthenticationError('Unauthorized');
  }

  const websiteId = parseInt(request.nextUrl.pathname.split('/')[3]);
  const urls = request.nextUrl.searchParams.get('urls')?.split(',') || [];

  if (isNaN(websiteId)) {
    throw new ValidationError('Invalid website ID');
  }

  const { website } = await getWebsiteById(websiteId);

  if (!website || website.user_id !== parseInt(session.user.id)) {
    throw new NotFoundError('Website not found');
  }

  try {
    const accessToken = await getValidAccessToken(website.user_id);
    const analyticsData = await getPageImpressionsAndClicks(websiteId, urls, accessToken);
    return NextResponse.json({ 
      data: analyticsData, 
      message: Object.keys(analyticsData).length === 0 ? 'No data returned from Google Search Console' : 'Data retrieved successfully' 
    });
  } catch (error) {
    console.error('Error in analytics API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});