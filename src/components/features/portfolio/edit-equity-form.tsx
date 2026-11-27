'use client';

import { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { getCurrencySymbol } from '@/lib/utils/format-settings';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface EditEquityFormProps {
  currentEquity: number;
  onEquityUpdated: () => void;
  trigger?: React.ReactNode;
}

export function EditEquityForm({ currentEquity, onEquityUpdated, trigger }: EditEquityFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [equity, setEquity] = useState(currentEquity.toString());
  const { settings } = useSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/portfolio/equity', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initialCapital: parseFloat(equity) }),
      });

      if (response.ok) {
        setIsOpen(false);
        onEquityUpdated();
      } else {
        alert('Failed to update equity');
      }
    } catch (error) {
      console.error('Error updating equity:', error);
      alert('Error updating equity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-positive">
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold tracking-tight">Edit Initial Capital</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Update your starting capital. This will recalculate all performance statistics.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="equity" className="text-sm font-medium text-muted-foreground">Initial Capital ({getCurrencySymbol(settings)})</Label>
            <Input
              id="equity"
              type="number"
              value={equity}
              onChange={(e) => setEquity(e.target.value)}
              placeholder="100000"
              required
              min="0"
              step="0.01"
              className="h-11"
            />
          </div>
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-11">
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

