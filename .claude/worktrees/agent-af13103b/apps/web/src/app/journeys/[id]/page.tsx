'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Clock3, Play, RefreshCw, Save } from 'lucide-react';
import {
  useJourneyStore,
  type JourneyExecution,
  type JourneyExecutionJob,
} from '../../../stores/useJourneyStore';
import { useRouter } from 'next/navigation';

type JourneyNodeData = {
  label?: string;
  kind?: string;
  eventType?: string;
  actionType?: string;
  message?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string | number | boolean;
  delayInSeconds?: number | string;
  delayInMinutes?: number | string;
  delayInHours?: number | string;
};

type JourneyNode = Node<JourneyNodeData>;
type JourneyEdgeData = {
  branch?: 'true' | 'false' | 'default';
};
type JourneyEdge = Edge<JourneyEdgeData>;

const triggerOptions = [
  { value: 'whatsapp_inbound_received', label: 'WhatsApp inbound' },
  { value: 'lead_form_submitted', label: 'Formulario publicado' },
  { value: 'manual_trigger', label: 'Teste manual' },
];

const actionOptions = [
  { value: 'append_card_activity', label: 'Registrar atividade' },
  { value: 'move_card_to_next_stage', label: 'Mover para proxima etapa' },
  { value: 'request_handoff', label: 'Solicitar handoff' },
];

const conditionOperatorOptions = [
  { value: 'exists', label: 'Existe' },
  { value: 'not_exists', label: 'Nao existe' },
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_contains', label: 'Nao contem' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
];

function resolveNodeKind(node: JourneyNode | null): string {
  return node?.data?.kind?.trim().toLowerCase() || 'unknown';
}

function resolveEdgeBranch(edge: JourneyEdge): 'true' | 'false' | 'default' {
  const explicitBranch = edge.data?.branch;
  if (explicitBranch === 'true' || explicitBranch === 'false') {
    return explicitBranch;
  }

  const label = typeof edge.label === 'string' ? edge.label.trim().toLowerCase() : '';
  if (label === 'sim' || label === 'true') {
    return 'true';
  }
  if (label === 'nao' || label === 'não' || label === 'false') {
    return 'false';
  }

  return 'default';
}

function getEdgeBranchLabel(branch: 'true' | 'false' | 'default'): string | undefined {
  if (branch === 'true') {
    return 'SIM';
  }
  if (branch === 'false') {
    return 'NAO';
  }

  return undefined;
}

const nodeTemplates = [
  {
    label: 'Gatilho WhatsApp',
    node: {
      type: 'default',
      data: {
        label: 'Trigger · WhatsApp Inbound',
        kind: 'trigger',
        eventType: 'whatsapp_inbound_received',
      },
    },
  },
  {
    label: 'Gatilho Formulário',
    node: {
      type: 'default',
      data: {
        label: 'Trigger · Formulário Público',
        kind: 'trigger',
        eventType: 'lead_form_submitted',
      },
    },
  },
  {
    label: 'Delay 5 minutos',
    node: {
      type: 'default',
      data: {
        label: 'Delay · Esperar 5 minutos',
        kind: 'delay',
        delayInMinutes: 5,
      },
    },
  },
  {
    label: 'Delay 1 hora',
    node: {
      type: 'default',
      data: {
        label: 'Delay · Esperar 1 hora',
        kind: 'delay',
        delayInMinutes: 60,
      },
    },
  },
  {
    label: 'Ação Registrar Atividade',
    node: {
      type: 'default',
      data: {
        label: 'Ação · Registrar atividade',
        kind: 'action',
        actionType: 'append_card_activity',
        message: 'Regua executada automaticamente pela jornada.',
      },
    },
  },
  {
    label: 'Ação Mover Card',
    node: {
      type: 'default',
      data: {
        label: 'Ação · Mover para próxima etapa',
        kind: 'action',
        actionType: 'move_card_to_next_stage',
      },
    },
  },
  {
    label: 'Ação Solicitar Handoff',
    node: {
      type: 'default',
      data: {
        label: 'Ação · Solicitar takeover manual',
        kind: 'action',
        actionType: 'request_handoff',
      },
    },
  },
  {
    label: 'Condição IF',
    node: {
      type: 'default',
      data: {
        label: 'Condição · triggerPayload.test = true',
        kind: 'condition',
        conditionField: 'triggerPayload.test',
        conditionOperator: 'equals',
        conditionValue: true,
      },
    },
  },
];

const executionStatusMeta: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Concluida',
    className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  },
  RUNNING: {
    label: 'Executando',
    className: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  },
  FAILED: {
    label: 'Falhou',
    className: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
  SKIPPED: {
    label: 'Ignorada',
    className: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  PENDING: {
    label: 'Pendente',
    className: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  },
};

function formatTriggerSource(source: string) {
  const mapping: Record<string, string> = {
    lead_form_submitted: 'Formulário',
    whatsapp_inbound_received: 'WhatsApp',
    manual_trigger: 'Teste manual',
  };

  return mapping[source] ?? source;
}

const jobStatusMeta: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Concluído',
    className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  },
  RUNNING: {
    label: 'Rodando',
    className: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  },
  FAILED: {
    label: 'Falhou',
    className: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
  SKIPPED: {
    label: 'Ignorado',
    className: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  PENDING: {
    label: 'Agendado',
    className: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export default function JourneyBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    currentJourney,
    fetchJourney,
    updateJourney,
    triggerJourney,
    processDueJobs,
    requeueFailedJob,
    requeueFailedExecutionJobs,
  } = useJourneyStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<JourneyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<JourneyEdge>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isProcessingRuntime, setIsProcessingRuntime] = useState(false);
  const [busyExecutionRequeueId, setBusyExecutionRequeueId] = useState<string | null>(null);
  const [busyJobRequeueId, setBusyJobRequeueId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    fetchJourney(resolvedParams.id);
  }, [resolvedParams.id, fetchJourney]);

  useEffect(() => {
    if (currentJourney?.id === resolvedParams.id) {
      setNodes((currentJourney.nodes ?? []) as JourneyNode[]);
      setEdges((currentJourney.edges ?? []) as JourneyEdge[]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [currentJourney, resolvedParams.id, setNodes, setEdges]);

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;
  const selectedNodeData = (selectedNode?.data ?? {}) as JourneyNodeData;
  const selectedEdgeSourceNode =
    selectedEdge?.source ? nodes.find((node) => node.id === selectedEdge.source) ?? null : null;
  const executionMetrics = useMemo(
    () =>
      (currentJourney?.recentExecutions ?? []).reduce(
        (summary, execution) => {
          if (execution.status === 'RUNNING') {
            summary.running += 1;
          }
          if (execution.failedJobCount > 0) {
            summary.failed += 1;
          }
          summary.pendingJobs += execution.pendingJobCount;
          return summary;
        },
        { running: 0, failed: 0, pendingJobs: 0 },
      ),
    [currentJourney?.recentExecutions],
  );

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<JourneyNodeData>) => {
      setNodes((existingNodes) =>
        existingNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const updateEdgeBranch = useCallback(
    (edgeId: string, branch: 'true' | 'false' | 'default') => {
      setEdges((existingEdges) =>
        existingEdges.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: branch === 'default' ? undefined : { branch },
                label: getEdgeBranchLabel(branch),
              }
            : edge,
        ),
      );
    },
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection | Edge) => {
      const sourceNode = connection.source
        ? nodes.find((node) => node.id === connection.source) ?? null
        : null;
      const sourceKind = resolveNodeKind(sourceNode);
      const nextBranch =
        sourceKind === 'condition'
          ? (() => {
              const existingBranches = edges
                .filter((edge) => edge.source === connection.source)
                .map((edge) => resolveEdgeBranch(edge));

              if (!existingBranches.includes('true')) {
                return 'true' as const;
              }
              if (!existingBranches.includes('false')) {
                return 'false' as const;
              }

              return 'default' as const;
            })()
          : 'default';

      const newEdge: JourneyEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        data: nextBranch === 'default' ? undefined : { branch: nextBranch },
        label: getEdgeBranchLabel(nextBranch),
      };

      setEdges((existingEdges) => addEdge(newEdge, existingEdges));
      setSelectedNodeId(null);
      setSelectedEdgeId(newEdge.id ?? null);
    },
    [edges, nodes, setEdges],
  );

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      await updateJourney(resolvedParams.id, {
        nodes: nodes as unknown[],
        edges: edges as unknown[],
      });
      setFeedback('Jornada salva com sucesso.');
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao salvar jornada.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!currentJourney) {
      return;
    }

    setFeedback(null);
    try {
      const updated = await updateJourney(resolvedParams.id, { isActive: !currentJourney.isActive });
      setFeedback(updated.isActive ? 'Jornada ativada.' : 'Jornada desativada.');
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao atualizar status da jornada.'));
    }
  };

  const handleTestFlow = async () => {
    setIsTriggering(true);
    setFeedback(null);

    try {
      const execution = await triggerJourney(resolvedParams.id, {
        origin: 'manual_ui',
        test: true,
        requestedAt: new Date().toISOString(),
      });
      const statusLabel = executionStatusMeta[execution.status]?.label ?? execution.status;
      setFeedback(`Execucao de teste registrada com status ${statusLabel.toLowerCase()}.`);
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao disparar a jornada.'));
    } finally {
      setIsTriggering(false);
    }
  };

  const handleAddNode = (template: (typeof nodeTemplates)[number]['node']) => {
    const newNode: JourneyNode = {
      id: `node_${Date.now()}`,
      type: template.type,
      position: {
        x: 120 + (nodes.length % 3) * 220,
        y: 120 + Math.floor(nodes.length / 3) * 160,
      },
      data: template.data,
    };

    setNodes((existingNodes) => existingNodes.concat(newNode));
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  };

  const handleProcessRuntime = async () => {
    setIsProcessingRuntime(true);
    setFeedback(null);

    try {
      const summary = await processDueJobs();
      setFeedback(
        `Runtime processou ${summary.processedJobs} job(s). Pendentes: ${summary.pendingJobs}.`,
      );
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao processar agendamentos.'));
    } finally {
      setIsProcessingRuntime(false);
    }
  };

  const handleRequeueExecution = async (executionId: string) => {
    setBusyExecutionRequeueId(executionId);
    setFeedback(null);

    try {
      const result = await requeueFailedExecutionJobs(executionId);
      setFeedback(`Execução reenfileirada com ${result.requeuedJobs} job(s) devolvido(s) para a fila.`);
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao reenfileirar execução.'));
    } finally {
      setBusyExecutionRequeueId(null);
    }
  };

  const handleRequeueJob = async (jobId: string) => {
    setBusyJobRequeueId(jobId);
    setFeedback(null);

    try {
      const result = await requeueFailedJob(jobId);
      setFeedback(`Job reenfileirado. ${result.requeuedJobs} item retornou para a fila.`);
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao reenfileirar job.'));
    } finally {
      setBusyJobRequeueId(null);
    }
  };

  if (!currentJourney || currentJourney.id !== resolvedParams.id) {
    return <div className="p-8 text-slate-300">Carregando construtor de jornada...</div>;
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.78)] shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
      <div className="border-b border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/journeys')}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Builder da régua</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{currentJourney.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-full ${currentJourney.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <span>{currentJourney.isActive ? 'Ativa' : 'Rascunho'}</span>
                <span>•</span>
                <span>{currentJourney.executionCount} execuções registradas</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggleActive}
              className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.08]"
            >
              {currentJourney.isActive ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={handleTestFlow}
              disabled={!currentJourney.isActive || isTriggering}
              className="flex items-center gap-2 rounded-2xl bg-emerald-400/[0.12] px-3 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-400/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> {isTriggering ? 'Executando...' : 'Testar fluxo'}
            </button>
            <button
              onClick={handleProcessRuntime}
              disabled={isProcessingRuntime}
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isProcessingRuntime ? 'animate-spin' : ''}`} />
              {isProcessingRuntime ? 'Processando...' : 'Processar agenda'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:translate-y-[-1px]"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar régua'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Nós</div>
            <div className="mt-2 text-lg font-semibold text-white">{nodes.length}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Arestas</div>
            <div className="mt-2 text-lg font-semibold text-white">{edges.length}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Execuções rodando</div>
            <div className="mt-2 text-lg font-semibold text-white">{executionMetrics.running}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Fila pendente</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {executionMetrics.pendingJobs}
              <span className="ml-2 text-xs font-medium text-slate-500">{executionMetrics.failed} com falha</span>
            </div>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className="border-b border-cyan-300/10 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{feedback}</div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id ?? null);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
            fitView
            className="bg-[linear-gradient(180deg,rgba(9,20,36,0.96),rgba(7,16,29,0.94))]"
          >
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />

            <Panel
              position="top-left"
              className="m-4 w-72 rounded-[24px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
            >
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white">Ferramentas</h3>
              <p className="mb-4 text-xs leading-5 text-slate-400">
                Monte a régua com gatilhos, branching, delays, avanço de etapa e handoff manual.
              </p>
              <div className="space-y-2">
                {nodeTemplates.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleAddNode(template.node)}
                    className="w-full rounded-2xl border border-transparent bg-white/[0.06] px-3 py-2 text-left text-sm text-slate-200 transition-all hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-100"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[rgba(4,10,20,0.72)]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Configuração do fluxo</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Selecione um nó ou uma aresta para ajustar gatilho, ação, delay e caminhos condicionais.
            </p>
          </div>

          <div className="space-y-4 border-b border-white/10 p-4">
            {selectedNode ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nó selecionado</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedNode.id}</div>
                <div className="mt-1 text-xs text-slate-500">Tipo: {resolveNodeKind(selectedNode)}</div>

                <div className="mt-4 space-y-3">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                    Rótulo
                    <input
                      value={selectedNodeData.label ?? ''}
                      onChange={(event) => updateNodeData(selectedNode.id, { label: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>

                  {resolveNodeKind(selectedNode) === 'trigger' ? (
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                      Evento
                      <select
                        value={selectedNodeData.eventType ?? 'whatsapp_inbound_received'}
                        onChange={(event) => updateNodeData(selectedNode.id, { eventType: event.target.value })}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        {triggerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {resolveNodeKind(selectedNode) === 'action' ? (
                    <>
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Ação
                        <select
                          value={selectedNodeData.actionType ?? 'append_card_activity'}
                          onChange={(event) => updateNodeData(selectedNode.id, { actionType: event.target.value })}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        >
                          {actionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {(selectedNodeData.actionType ?? 'append_card_activity') === 'append_card_activity' ? (
                        <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                          Mensagem da atividade
                          <textarea
                            rows={3}
                            value={selectedNodeData.message ?? ''}
                            onChange={(event) => updateNodeData(selectedNode.id, { message: event.target.value })}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                          />
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {resolveNodeKind(selectedNode) === 'delay' ? (
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                      Delay em segundos
                      <input
                        type="number"
                        min={0}
                        value={selectedNodeData.delayInSeconds ?? ''}
                        onChange={(event) =>
                          updateNodeData(selectedNode.id, {
                            delayInSeconds: event.target.value,
                            delayInMinutes: '',
                            delayInHours: '',
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                  ) : null}

                  {resolveNodeKind(selectedNode) === 'condition' ? (
                    <>
                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Campo avaliado
                        <input
                          value={selectedNodeData.conditionField ?? ''}
                          onChange={(event) =>
                            updateNodeData(selectedNode.id, { conditionField: event.target.value })
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                          placeholder="triggerPayload.test, contact.phone, company.industry, card.stage.name"
                        />
                      </label>

                      <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                        Operador
                        <select
                          value={selectedNodeData.conditionOperator ?? 'equals'}
                          onChange={(event) =>
                            updateNodeData(selectedNode.id, { conditionOperator: event.target.value })
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        >
                          {conditionOperatorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {!(selectedNodeData.conditionOperator === 'exists' || selectedNodeData.conditionOperator === 'not_exists') ? (
                        <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
                          Valor esperado
                          <input
                            value={
                              selectedNodeData.conditionValue === undefined
                                ? ''
                                : String(selectedNodeData.conditionValue)
                            }
                            onChange={(event) =>
                              updateNodeData(selectedNode.id, { conditionValue: event.target.value })
                            }
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                            placeholder="true, false, WhatsApp, Qualificação"
                          />
                        </label>
                      ) : null}

                      <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/10 px-3 py-3 text-xs leading-6 text-cyan-100">
                        Ligue duas arestas saindo deste nó. A primeira ganha <span className="font-semibold">SIM</span> e a segunda <span className="font-semibold">NAO</span>. Se precisar, ajuste a aresta selecionada abaixo.
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            ) : selectedEdge ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aresta selecionada</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedEdge.source} → {selectedEdge.target}
                </div>
                {resolveNodeKind(selectedEdgeSourceNode as JourneyNode | null) === 'condition' && selectedEdge.id ? (
                  <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-slate-500">
                    Caminho da condição
                    <select
                      value={resolveEdgeBranch(selectedEdge)}
                      onChange={(event) =>
                        updateEdgeBranch(
                          selectedEdge.id as string,
                          event.target.value as 'true' | 'false' | 'default',
                        )
                      }
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      <option value="true">SIM</option>
                      <option value="false">NAO</option>
                      <option value="default">Sempre</option>
                    </select>
                  </label>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 text-slate-400">
                    Esta aresta nao precisa de configuracao adicional porque nao sai de um nó condicional.
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-500">
                Selecione um nó para editar seus dados ou uma aresta de condição para marcar o caminho SIM/NAO.
              </div>
            )}
          </div>

          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Execuções recentes</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Leia o que disparou a jornada, qual ação foi tomada e onde a execução parou.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {currentJourney.recentExecutions && currentJourney.recentExecutions.length > 0 ? (
              currentJourney.recentExecutions.map((execution: JourneyExecution) => {
                const statusMeta = executionStatusMeta[execution.status] ?? executionStatusMeta.PENDING;

                return (
                  <section
                    key={execution.id}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{formatTriggerSource(execution.triggerSource)}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(execution.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <div className="uppercase tracking-[0.18em] text-slate-500">Contato</div>
                        <div className="mt-1 break-all text-slate-200">{execution.contactId ?? 'Não vinculado'}</div>
                      </div>
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <div className="uppercase tracking-[0.18em] text-slate-500">Card</div>
                        <div className="mt-1 break-all text-slate-200">{execution.cardId ?? 'Não vinculado'}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <div className="uppercase tracking-[0.18em] text-slate-500">Fila</div>
                        <div className="mt-1 text-slate-200">
                          {execution.pendingJobCount} pendente(s) · {execution.runningJobCount} rodando
                        </div>
                        <div className="mt-1 text-slate-500">
                          {execution.failedJobCount} dead-letter / falhado(s)
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <div className="uppercase tracking-[0.18em] text-slate-500">Próximo disparo</div>
                        <div className="mt-1 text-slate-200">
                          {execution.nextScheduledAt
                            ? new Date(execution.nextScheduledAt).toLocaleString()
                            : 'Sem agendamento futuro'}
                        </div>
                      </div>
                    </div>

                    {execution.failedJobCount > 0 ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleRequeueExecution(execution.id)}
                          disabled={busyExecutionRequeueId === execution.id}
                          className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyExecutionRequeueId === execution.id
                            ? 'Reenfileirando execução...'
                            : 'Reenfileirar jobs falhos'}
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Jobs agendados
                      </div>
                      {execution.jobs.length > 0 ? (
                        execution.jobs.map((job: JourneyExecutionJob) => {
                          const statusMeta = jobStatusMeta[job.status] ?? jobStatusMeta.PENDING;

                          return (
                            <div
                              key={job.id}
                              className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-medium text-slate-200">
                                  {job.nodeLabel ?? job.nodeId}
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {job.actionType ?? job.nodeKind} · {new Date(job.scheduledFor).toLocaleString()}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                tentativa {job.attempts}
                                {job.lastError ? ` · ${job.lastError}` : ''}
                              </div>
                              {job.deadLetteredAt ? (
                                <div className="mt-1 text-xs text-amber-200">
                                  dead-letter em {new Date(job.deadLetteredAt).toLocaleString()}
                                  {job.deadLetterReason ? ` · ${job.deadLetterReason}` : ''}
                                </div>
                              ) : null}
                              {job.manuallyRequeuedAt ? (
                                <div className="mt-1 text-xs text-cyan-100">
                                  requeue manual {job.manualRequeueCount}x ·{' '}
                                  {new Date(job.manuallyRequeuedAt).toLocaleString()}
                                </div>
                              ) : null}
                              {job.status === 'FAILED' ? (
                                <div className="mt-3 flex justify-end">
                                  <button
                                    onClick={() => handleRequeueJob(job.id)}
                                    disabled={busyJobRequeueId === job.id}
                                    className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-400/16 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {busyJobRequeueId === job.id ? 'Reenfileirando...' : 'Reenfileirar job'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                          Esta execução ainda não gerou jobs.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      {execution.logs.length > 0 ? (
                        execution.logs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-medium text-slate-200">{log.nodeLabel ?? 'Runtime'}</div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  log.level === 'ERROR'
                                    ? 'bg-rose-500/12 text-rose-200'
                                    : log.level === 'WARN'
                                      ? 'bg-amber-500/12 text-amber-100'
                                      : 'bg-cyan-500/12 text-cyan-100'
                                }`}
                              >
                                {log.level}
                              </span>
                            </div>
                            <div className="mt-1 text-sm leading-5 text-slate-300">{log.message}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                          Esta execução ainda não gerou logs.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                Ainda não existem execuções registradas para esta jornada.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
