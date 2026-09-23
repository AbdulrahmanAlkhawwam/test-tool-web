'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Copies `text` to the clipboard. The text is passed in and handed straight to the clipboard API —
 * nothing is stored here, so this is safe for the one-time token. When the clipboard is unavailable
 * (an insecure context, a browser that refuses without a gesture) the text stays on screen and the
 * tester is told to copy it by hand.
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={() => void copy()}>
      {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
