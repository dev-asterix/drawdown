'use client';

import { useState, useEffect } from 'react';
import { DailyPnL } from '@/types/trading';
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface EditTransactionFormProps {
  entry: DailyPnL | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<DailyPnL>) => Promise<void>;
}

export function EditTransactionForm({ entry, isOpen, onClose, onUpdate }: EditTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    pnl: '',
    notes: '',
  });

  useEffect(() => {
    if (entry) {
      const date = new Date(entry.date);
      const formattedDate = date.toISOString().split('T')[0];
      setFormData({
        date: formattedDate,
        pnl: (entry.pnl ?? 0).toString(),
        notes: entry.notes || '',
      });
    } else {
      // Reset form when no entry
      setFormData({
        date: '',
        pnl: '',
        notes: '',
      });
    }
  }, [entry]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setLoading(true);

    try {
      await onUpdate(entry.id, {
        date: new Date(formData.date),
        pnl: parseFloat(formData.pnl),
        notes: formData.notes || undefined,
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Error updating entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold tracking-tight">Edit P&L Entry</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Make changes to your daily P&L entry here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right text-sm font-medium text-muted-foreground">
              Date
            </Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="col-span-3 h-11"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="pnl" className="text-right pt-3 text-sm font-medium text-muted-foreground">
              Amount
            </Label>
            <div className="col-span-3 space-y-2">
              <Input
                id="pnl"
                name="pnl"
                type="number"
                step="0.01"
                placeholder="Enter profit or loss"
                value={formData.pnl}
                onChange={handleChange}
                required
                className="h-11"
              />
              <p className="text-sm text-muted-foreground font-medium">
                Positive for profit, negative for loss
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-3 text-sm font-medium text-muted-foreground">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Any notes about the day..."
              value={formData.notes}
              onChange={handleChange}
              className="col-span-3 min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-11">
              {loading ? 'Updating...' : 'Update P&L'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
