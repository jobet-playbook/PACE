"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  coreKnowledgeDocs,
  codeReviewKnowledgeDocs,
  testingKnowledgeDocs,
  kdEditLog,
} from "@/lib/dashboard-data"
import type { KnowledgeDocEntry, KDEditLogEntry, KDCategory } from "@/lib/dashboard-data"
import {
  FileText,
  Code,
  TestTube,
  Plus,
  Save,
  X,
  Edit3,
  CheckCircle,
  Clock,
  History,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface KDSubtabProps {
  category: KDCategory
  docs: KnowledgeDocEntry[]
  editLog: KDEditLogEntry[]
}

function KDSubtab({ category, docs, editLog }: KDSubtabProps) {
  const [localDocs, setLocalDocs] = useState<KnowledgeDocEntry[]>(docs)
  const [localEditLog, setLocalEditLog] = useState<KDEditLogEntry[]>(editLog)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState("")
  const [newDocContent, setNewDocContent] = useState("")

  const categoryEditLog = useMemo(() => {
    const docIds = localDocs.map((d) => d.id)
    return localEditLog.filter((e) => docIds.includes(e.docId))
  }, [localDocs, localEditLog])

  const handleStartEdit = (doc: KnowledgeDocEntry) => {
    setEditingId(doc.id)
    setEditContent(doc.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const handleSaveEdit = (doc: KnowledgeDocEntry) => {
    if (editContent.trim() === doc.content) {
      handleCancelEdit()
      return
    }

    const now = new Date()
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getDate().toString().padStart(2, "0")}/${now.getFullYear().toString().slice(-2)}`
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

    // Update doc
    setLocalDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id ? { ...d, content: editContent, lastEdited: dateStr } : d
      )
    )

    // Add to edit log
    const newLogEntry: KDEditLogEntry = {
      id: `EDIT-${Date.now()}`,
      docId: doc.id,
      docTitle: doc.title,
      editedBy: "Current User",
      editedAt: `${dateStr} ${timeStr}`,
      changeType: "Updated",
      previousContent: doc.content,
      newContent: editContent,
      notes: "User edit via dashboard",
    }
    setLocalEditLog((prev) => [newLogEntry, ...prev])

    handleCancelEdit()
  }

  const handleAddNewDoc = () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return

    const now = new Date()
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getDate().toString().padStart(2, "0")}/${now.getFullYear().toString().slice(-2)}`
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

    const newDoc: KnowledgeDocEntry = {
      id: `KD-${category.charAt(0)}${Date.now()}`,
      category,
      title: newDocTitle,
      content: newDocContent,
      author: "Current User",
      dateAdded: dateStr,
      lastEdited: null,
      isOfficial: false,
    }

    setLocalDocs((prev) => [newDoc, ...prev])

    // Add to edit log
    const newLogEntry: KDEditLogEntry = {
      id: `EDIT-${Date.now()}`,
      docId: newDoc.id,
      docTitle: newDoc.title,
      editedBy: "Current User",
      editedAt: `${dateStr} ${timeStr}`,
      changeType: "Created",
      previousContent: null,
      newContent: newDocContent,
      notes: "New doc created via dashboard",
    }
    setLocalEditLog((prev) => [newLogEntry, ...prev])

    setIsAddingNew(false)
    setNewDocTitle("")
    setNewDocContent("")
  }

  return (
    <Tabs defaultValue="docs" className="gap-3">
      <TabsList className="h-8">
        <TabsTrigger value="docs" className="gap-1 px-3 text-[10px]">
          <BookOpen className="size-3" />
          <span>Daily Additions</span>
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
            {localDocs.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="edit-log" className="gap-1 px-3 text-[10px]">
          <History className="size-3" />
          <span>Edit Log</span>
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
            {categoryEditLog.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* Docs Tab */}
      <TabsContent value="docs">
        <div className="flex flex-col gap-3">
          {/* Add New Button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant={isAddingNew ? "secondary" : "default"}
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="h-7 px-3 text-[10px] gap-1"
            >
              {isAddingNew ? (
                <>
                  <X className="size-3" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="size-3" />
                  Add New Doc
                </>
              )}
            </Button>
          </div>

          {/* New Doc Form */}
          {isAddingNew && (
            <Card className="p-3 gap-2 border-primary/50 bg-primary/5">
              <p className="text-[10px] font-semibold uppercase text-primary tracking-wide">
                New Knowledge Doc
              </p>
              <Input
                placeholder="Document Title"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="h-8 text-xs"
              />
              <Textarea
                placeholder="Document Content (use markdown-like formatting)"
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                className="min-h-[120px] text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingNew(false)
                    setNewDocTitle("")
                    setNewDocContent("")
                  }}
                  className="h-7 px-3 text-[10px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNewDoc}
                  disabled={!newDocTitle.trim() || !newDocContent.trim()}
                  className="h-7 px-3 text-[10px] gap-1"
                >
                  <Save className="size-3" />
                  Save Doc
                </Button>
              </div>
            </Card>
          )}

          {/* Doc List */}
          <div className="flex flex-col gap-2">
            {localDocs.map((doc) => (
              <Card
                key={doc.id}
                className={cn(
                  "p-3 gap-2",
                  !doc.isOfficial && "border-l-4 border-l-amber-500"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-foreground">
                        {doc.title}
                      </h4>
                      {doc.isOfficial ? (
                        <Badge
                          variant="default"
                          className="h-4 px-1.5 text-[8px] bg-chart-2 hover:bg-chart-2"
                        >
                          <CheckCircle className="size-2 mr-0.5" />
                          Official
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[8px] border-amber-500 text-amber-600"
                        >
                          <Clock className="size-2 mr-0.5" />
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      By {doc.author} on {doc.dateAdded}
                      {doc.lastEdited && ` (edited ${doc.lastEdited})`}
                    </p>
                  </div>
                  {editingId !== doc.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(doc)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="size-3" />
                    </Button>
                  )}
                </div>

                {editingId === doc.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[100px] text-[10px] font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-6 px-2 text-[9px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(doc)}
                        className="h-6 px-2 text-[9px] gap-1"
                      >
                        <Save className="size-2.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded">
                    {doc.content}
                  </pre>
                )}
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* Edit Log Tab */}
      <TabsContent value="edit-log">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[9px] font-semibold h-8 px-2">Type</TableHead>
                <TableHead className="text-[9px] font-semibold h-8 px-2">Document</TableHead>
                <TableHead className="text-[9px] font-semibold h-8 px-2">Edited By</TableHead>
                <TableHead className="text-[9px] font-semibold h-8 px-2">Date</TableHead>
                <TableHead className="text-[9px] font-semibold h-8 px-2">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryEditLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No edits recorded for this category.
                  </TableCell>
                </TableRow>
              ) : (
                categoryEditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-[10px] px-2 py-1.5">
                      <Badge
                        variant={
                          entry.changeType === "Created"
                            ? "default"
                            : entry.changeType === "Approved"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          "text-[8px] h-4 px-1.5",
                          entry.changeType === "Created" && "bg-chart-2 hover:bg-chart-2",
                          entry.changeType === "Updated" && "border-primary text-primary",
                          entry.changeType === "Approved" && "bg-chart-2/20 text-chart-2 border-chart-2"
                        )}
                      >
                        {entry.changeType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 font-medium max-w-[200px] truncate">
                      {entry.docTitle}
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5">{entry.editedBy}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground">
                      {entry.editedAt}
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground max-w-[250px] truncate">
                      {entry.notes}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

export function ClientKnowledgeDashboard() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg bg-primary px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary-foreground" />
          <h2 className="text-sm font-semibold text-primary-foreground">
            Client.MD - Knowledge Documentation
          </h2>
        </div>
        <p className="text-[10px] text-primary-foreground/80 mt-1">
          Daily additions to knowledge docs. Edit and save to add officially to files. All edits are logged.
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="core" className="gap-4">
        <TabsList className="h-9">
          <TabsTrigger value="core" className="gap-1.5 px-4 text-xs">
            <FileText className="size-3.5" />
            <span>Core KD</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {coreKnowledgeDocs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="code-review" className="gap-1.5 px-4 text-xs">
            <Code className="size-3.5" />
            <span>Code Review KD</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {codeReviewKnowledgeDocs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="testing" className="gap-1.5 px-4 text-xs">
            <TestTube className="size-3.5" />
            <span>Testing KD</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {testingKnowledgeDocs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="core">
          <KDSubtab
            category="Core"
            docs={coreKnowledgeDocs}
            editLog={kdEditLog}
          />
        </TabsContent>

        <TabsContent value="code-review">
          <KDSubtab
            category="Code Review"
            docs={codeReviewKnowledgeDocs}
            editLog={kdEditLog}
          />
        </TabsContent>

        <TabsContent value="testing">
          <KDSubtab
            category="Testing"
            docs={testingKnowledgeDocs}
            editLog={kdEditLog}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
