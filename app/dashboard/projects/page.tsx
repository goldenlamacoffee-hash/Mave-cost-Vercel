import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAllCostCenters, getTechnicalProjectsWithCenters } from "@/lib/queries"
import { formatDateTime } from "@/lib/format"
import { AssignCostCenterSelect } from "@/components/assign-cost-center-select"

export const dynamic = "force-dynamic"

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Technical Projects</h1>
        <p className="text-sm text-muted-foreground">
          Vercel projects discovered during sync. Assign each project to a business cost center.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ProjectsContent />
      </Suspense>
    </div>
  )
}

async function ProjectsContent() {
  const [rows, costCenters] = await Promise.all([
    getTechnicalProjectsWithCenters(),
    getAllCostCenters(),
  ])

  const ccOptions = costCenters.map((cc) => ({ id: cc.id, name: cc.name }))
  const unmappedCount = rows.filter((r) => !r.project.businessCostCenterId).length

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{rows.length} projects</span>
          {unmappedCount > 0 && <Badge variant="destructive">{unmappedCount} unmapped</Badge>}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Run a sync from the Sync page to discover Vercel projects.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Mapping</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Cost center</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ project, costCenterName }) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    {project.externalProjectName ?? project.externalProjectId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.provider}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        project.mappingConfidence === "unmapped"
                          ? "destructive"
                          : project.mappingConfidence === "manual"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {project.mappingConfidence ?? "unmapped"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(project.updatedAt)}</TableCell>
                  <TableCell>
                    <AssignCostCenterSelect
                      targetType="project"
                      targetId={project.id}
                      currentCostCenterId={project.businessCostCenterId}
                      costCenters={ccOptions}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
