'use client';
import { useEffect } from 'react';
import { installSwipeClose } from '@/lib/swipeClose';

// Turns on "swipe down to close" for every popup window in the app.
export default function SwipeClose() {
  useEffect(() => { installSwipeClose(); }, []);
  return null;
}
