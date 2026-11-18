'use client';
import { useEffect } from 'react';
import { installSwipeClose } from '@/lib/swipeClose';

// Turns on "swipe down to close" for popup windows marked with data-swipe-close.
export default function SwipeClose() {
  useEffect(() => { installSwipeClose(); }, []);
  return null;
}
