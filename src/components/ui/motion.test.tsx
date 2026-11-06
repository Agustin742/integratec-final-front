import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { Input } from './input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('Button motion', () => {
  it('carries the press motion class when interactive', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'motion-press',
    );
  });

  it('does not pop when disabled or busy', () => {
    render(
      <>
        <Button disabled>Off</Button>
        <Button busy>Busy</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Off' })).not.toHaveClass(
      'motion-press',
    );
    expect(screen.getByRole('button', { name: 'Busy' })).not.toHaveClass(
      'motion-press',
    );
  });
});

describe('Input motion', () => {
  it('transitions border and ring changes', () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveClass('motion-field');
  });
});

describe('Dialog motion', () => {
  it('animates overlay and content through data-state', async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByText('Open'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('data-[state=open]:animate-dialog-in');
    expect(dialog.className).toContain(
      'data-[state=closed]:animate-dialog-out',
    );
    const overlay = document.querySelector('[data-state="open"].fixed.inset-0');
    expect(overlay?.className).toContain('data-[state=open]:animate-fade-in');
  });
});

describe('Sheet motion', () => {
  it.each([
    ['right', 'sheet-right'],
    ['left', 'sheet-left'],
  ] as const)('slides in from the %s side', async (side, name) => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side={side}>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('Open'));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.className).toContain(`data-[state=open]:animate-${name}-in`);
    expect(sheet.className).toContain(
      `data-[state=closed]:animate-${name}-out`,
    );
    expect(sheet.className).not.toContain('animate-dialog-in');
  });
});

describe('Tabs motion', () => {
  it('fades content in and transitions trigger colors', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Body</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveClass('motion-colors');
    expect(screen.getByText('Body').className).toContain(
      'data-[state=active]:animate-fade-in',
    );
  });
});
