import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { messages } from './messages';

export function UiFoundations() {
  const copy = messages.showcase;

  return (
    <section
      id="ui-foundations"
      aria-labelledby="ui-foundations-title"
      className="min-w-0 space-y-6"
    >
      <div>
        <h2 id="ui-foundations-title" className="text-xl font-semibold">
          {copy.title}
        </h2>
        <p className="text-muted-foreground">{copy.localOnly}</p>
      </div>
      <div
        className="grid min-w-0 gap-4 sm:grid-cols-2"
        aria-label={copy.states}
        role="group"
      >
        <div
          aria-busy="true"
          className="min-w-0 space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-panel"
        >
          <Button busy className="max-w-full whitespace-normal">
            {copy.loading}
          </Button>
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground shadow-panel">
          <Badge className="max-w-full whitespace-normal">{copy.success}</Badge>
        </div>
      </div>
      <Alert variant="destructive">
        <AlertTitle>{copy.error}</AlertTitle>
        <AlertDescription>{copy.errorHelp}</AlertDescription>
      </Alert>
      <Tabs defaultValue="controls" className="min-w-0">
        <TabsList
          aria-label={copy.tabs}
          className="flex h-auto flex-wrap justify-start"
        >
          <TabsTrigger value="controls">{copy.controls}</TabsTrigger>
          <TabsTrigger value="overlays">{copy.overlays}</TabsTrigger>
        </TabsList>
        <TabsContent value="controls" className="min-w-0 space-y-4">
          <Field
            label={copy.fieldLabel}
            description={copy.fieldHelp}
            error={copy.validation}
          >
            {(controlProps) => <Input {...controlProps} />}
          </Field>
          <Button
            disabled
            variant="outline"
            className="max-w-full whitespace-normal"
          >
            {copy.disabled}
          </Button>
          <Table containerLabel={copy.tableRegion} className="table-fixed">
            <TableCaption>{copy.tableCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.column}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="whitespace-normal">
                  {copy.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="overlays" className="min-w-0 space-y-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="max-w-full whitespace-normal"
              >
                {copy.openSheet}
              </Button>
            </SheetTrigger>
            <SheetContent className="[overflow-wrap:anywhere]">
              <SheetTitle>{copy.sheetTitle}</SheetTitle>
              <SheetDescription>{copy.sheetDescription}</SheetDescription>
            </SheetContent>
          </Sheet>
          <div>
            <Button
              variant="secondary"
              onClick={() => toast(copy.toast)}
              className="max-w-full whitespace-normal"
            >
              {copy.showToast}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="max-w-full whitespace-normal">
            {copy.openDialog}
          </Button>
        </DialogTrigger>
        <DialogContent className="[overflow-wrap:anywhere]">
          <DialogTitle>{copy.dialogTitle}</DialogTitle>
          <DialogDescription>{copy.dialogDescription}</DialogDescription>
          <p>{copy.dialogBody}</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
