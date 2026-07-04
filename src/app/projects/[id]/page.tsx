import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import {
  artifactUrl,
  blueprintSections,
  finalArtifact,
  internalArtifacts,
  metrics,
  project,
  qualityGate,
  revisionSummary,
} from "@/lib/demo-data";
import { getCurrentUser } from "@/lib/auth";
import { getProject, listProjectArtifacts, listProjectRuns } from "@/lib/product-store";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id !== project.id) {
    const user = await getCurrentUser();
    const storedProject = getProject(user.id, id);
    if (!storedProject) notFound();

    const runs = listProjectRuns(user.id, id);
    const artifacts = listProjectArtifacts(user.id, id);
    const latestRun = runs[0];
    const latestBlueprint = artifacts.find((artifact) => artifact.kind === "paper_blueprint");
    const internalArtifacts = artifacts.filter((artifact) => artifact.kind !== "paper_blueprint");

    return (
      <main className="main">
        <section className="hero">
          <div>
            <p className="eyebrow">Research Project</p>
            <div className="section-title">
              <h1>{storedProject.title}</h1>
            </div>
            <p className="lead">{storedProject.topic}</p>
          </div>
          <div className="hero-actions">
            <Link className="button" href="/workspace">
              <ArrowLeft size={16} /> Workspace
            </Link>
          </div>
        </section>

        <section className="metrics">
          <div className="metric">
            <strong>{runs.length}</strong>
            <span>Runs</span>
          </div>
          <div className="metric">
            <strong>{artifacts.length}</strong>
            <span>Artifacts</span>
          </div>
          <div className="metric">
            <strong>{latestRun?.status ?? storedProject.status}</strong>
            <span>Status</span>
          </div>
        </section>

        <div className="project-grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <h2>Latest blueprint</h2>
                <p className="subtle small">The final user-facing artifact will be versioned here as runs complete.</p>
              </div>
              <span className="badge success">{latestRun?.currentStatus ?? "Ready for a run"}</span>
            </div>
            {latestBlueprint ? (
              <a className="artifact-card" href={`/api/artifacts/${latestBlueprint.id}/download`}>
                <div>
                  <strong>{latestBlueprint.fileName}</strong>
                  <p>Version {latestBlueprint.version}</p>
                  <p className="small subtle">{latestBlueprint.createdAt}</p>
                </div>
                <Download size={17} />
              </a>
            ) : (
              <p className="subtle">No blueprint has been generated for this project yet.</p>
            )}

            <section className="panel">
              <div className="section-title">
                <div>
                  <h3>Internal process / Agent outputs</h3>
                  <p className="subtle small">Inspectable handoff artifacts used by agents and quality gates.</p>
                </div>
              </div>
              <div className="artifact-list">
                {internalArtifacts.map((artifact) => (
                  <details className="artifact-details" key={artifact.id}>
                    <summary>
                      <span>
                        <strong>{artifact.fileName}</strong>
                        <small>{artifact.kind} · v{artifact.version}</small>
                      </span>
                      <a href={`/api/artifacts/${artifact.id}/download`}>
                        <Download size={15} /> Download
                      </a>
                    </summary>
                    <pre>{formatArtifactPreview(artifact.content)}</pre>
                  </details>
                ))}
                {!internalArtifacts.length ? <p className="subtle">No internal artifacts have been persisted yet.</p> : null}
              </div>
            </section>
          </section>

          <aside>
            <section className="panel">
              <div className="section-title">
                <h2>Recent runs</h2>
              </div>
              <div className="chat-list">
                {runs.map((run) => (
                  <article className="chat-row" key={run.id}>
                    <div className="chat-meta">
                      <span>{run.status}</span>
                      <span>{run.updatedAt}</span>
                    </div>
                    <p>{run.currentStatus}</p>
                  </article>
                ))}
                {!runs.length ? <p className="subtle">No runs yet.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <section className="hero">
        <div>
          <p className="eyebrow">Paper Blueprint</p>
          <div className="section-title">
            <h1>{project.shortTitle}</h1>
          </div>
          <p className="lead">
            最终给用户看的主产物是一个详细论文框架。内部 JSON 只作为 Agent 之间的工作材料和可追溯记录，不再作为主下载列表展示。
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button" href="/workspace">
            <ArrowLeft size={16} /> Workspace
          </Link>
          <a className="button primary" href={artifactUrl()}>
            <Download size={16} /> Open blueprint
          </a>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </section>

      <div className="project-grid">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>{finalArtifact.file}</h2>
              <p className="subtle small">
                用户主产物：可继续撰写论文的详细框架，而不是完整论文初稿。
              </p>
            </div>
            <span className="badge success">{project.status}</span>
          </div>
          <a className="artifact-card" href={artifactUrl()}>
            <div>
              <strong>{finalArtifact.label}</strong>
              <p>{finalArtifact.summary}</p>
              <p className="small subtle">Owner: {finalArtifact.owner}</p>
            </div>
            <Download size={17} />
          </a>

          <section className="panel">
            <div className="section-title">
              <h3>Blueprint sections</h3>
            </div>
            <div className="split">
              {blueprintSections.map((section) => (
                <div className="detail-box" key={section}>
                  <b>{section}</b>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside>
          <section className="panel">
            <div className="section-title">
              <h2>Project status</h2>
            </div>
            <dl className="kv">
              <div>
                <dt>Phase</dt>
                <dd>{project.phase}</dd>
              </div>
              <div>
                <dt>Audience</dt>
                <dd>{project.audience}</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>paper-blueprint.md</dd>
              </div>
              <div>
                <dt>Live API</dt>
                <dd>Future phase</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Internal process</h2>
            </div>
            <div className="chat-list">
              {internalArtifacts.map((artifact) => (
                <article className="chat-row" key={artifact.file}>
                  <div className="chat-meta">
                    <span>{artifact.file}</span>
                    <span>{artifact.owner}</span>
                  </div>
                  <p>{artifact.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Revision summary</h2>
            </div>
            <div className="revision-list">
              {revisionSummary.map((revision) => (
                <article className="revision-item" key={`${revision.type}-${revision.route}`}>
                  <strong>{revision.type}</strong>
                  <p>Returned to: {revision.route}</p>
                  <p>Loaded skill: {revision.skill}</p>
                  <p>{revision.change}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Quality gate</h2>
            </div>
            <div className="revision-list">
              {qualityGate.map((gate) => (
                <article className="revision-item" key={gate.label}>
                  <strong>
                    {gate.label}: {gate.status}
                  </strong>
                  <p>{gate.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function formatArtifactPreview(content: string) {
  return content.length > 1600 ? `${content.slice(0, 1600)}\n...` : content;
}
