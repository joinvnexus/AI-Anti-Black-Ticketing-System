import { Injectable, Logger } from '@nestjs/common';

type GraphEdge = {
  fromType: 'account' | 'device' | 'ip' | 'payment' | 'wallet' | 'phone';
  fromId: string;
  toType: 'account' | 'device' | 'ip' | 'payment' | 'wallet' | 'phone';
  toId: string;
  relationship: string;
};

@Injectable()
export class FraudGraphService {
  private readonly logger = new Logger(FraudGraphService.name);
  private readonly edges: GraphEdge[] = [];
  private readonly incidents: Array<{
    paymentReference: string;
    accountId: string;
    incident: 'payment_failed' | 'chargeback';
    occurredAt: string;
  }> = [];

  async sync(edges: GraphEdge[]) {
    this.edges.push(...edges);

    for (const edge of edges) {
      this.logger.log(
        `graph ${edge.fromType}:${edge.fromId} -[${edge.relationship}]-> ${edge.toType}:${edge.toId}`,
      );
    }
  }

  getSchema() {
    return {
      nodes: ['Account', 'IP', 'Device', 'Wallet', 'Phone'],
      relationships: ['USES_DEVICE', 'USES_IP', 'USES_WALLET', 'USES_PHONE', 'JOINED_QUEUE', 'PAID_WITH'],
    };
  }

  getClusters(accountId: string) {
    const related = new Set<string>([`account:${accountId}`]);

    for (const edge of this.edges) {
      if (
        (edge.fromType === 'account' && edge.fromId === accountId) ||
        (edge.toType === 'account' && edge.toId === accountId)
      ) {
        related.add(`${edge.fromType}:${edge.fromId}`);
        related.add(`${edge.toType}:${edge.toId}`);
      }
    }

    return {
      accountId,
      cluster: [...related],
      graphRisk: this.scoreAccountNetworkRisk(accountId),
      embedding: this.getEmbedding(accountId),
      explainability: this.getExplainability(accountId),
    };
  }

  scoreAccountNetworkRisk(accountId: string, deviceId?: string) {
    const edges = this.edges.filter(
      (edge) =>
        (edge.fromType === 'account' && edge.fromId === accountId) ||
        (edge.toType === 'account' && edge.toId === accountId) ||
        (!!deviceId &&
          ((edge.fromType === 'device' && edge.fromId === deviceId) ||
            (edge.toType === 'device' && edge.toId === deviceId))),
    );

    const chargebackCount = this.incidents.filter(
      (incident) => incident.accountId === accountId && incident.incident === 'chargeback',
    ).length;

    return Math.min(100, edges.length * 10 + chargebackCount * 25);
  }

  registerPaymentIncident(input: {
    paymentReference: string;
    accountId: string;
    incident: 'payment_failed' | 'chargeback';
  }) {
    this.incidents.push({
      ...input,
      occurredAt: new Date().toISOString(),
    });

    return {
      accepted: true,
      graphRisk: this.scoreAccountNetworkRisk(input.accountId),
    };
  }

  getExplainability(accountId: string, deviceId?: string) {
    const edges = this.edges.filter(
      (edge) =>
        (edge.fromType === 'account' && edge.fromId === accountId) ||
        (edge.toType === 'account' && edge.toId === accountId) ||
        (!!deviceId &&
          ((edge.fromType === 'device' && edge.fromId === deviceId) ||
            (edge.toType === 'device' && edge.toId === deviceId))),
    );
    const paymentIncidents = this.incidents.filter(
      (incident) => incident.accountId === accountId,
    );
    const sharedDevices = new Set(
      edges
        .filter((edge) => edge.fromType === 'device' || edge.toType === 'device')
        .map((edge) => (edge.fromType === 'device' ? edge.fromId : edge.toId)),
    ).size;

    return {
      accountId,
      graphRisk: this.scoreAccountNetworkRisk(accountId, deviceId),
      drivers: [
        `shared_device_count:${sharedDevices}`,
        `connected_edge_count:${edges.length}`,
        `payment_incident_count:${paymentIncidents.length}`,
      ],
      incidents: paymentIncidents,
    };
  }

  getNetworkSnapshot() {
    return {
      edgeCount: this.edges.length,
      incidentCount: this.incidents.length,
      chargebackCount: this.incidents.filter((incident) => incident.incident === 'chargeback').length,
    };
  }

  private getEmbedding(accountId: string) {
    const connectedEdges = this.edges.filter(
      (edge) =>
        (edge.fromType === 'account' && edge.fromId === accountId) ||
        (edge.toType === 'account' && edge.toId === accountId),
    );

    return [
      connectedEdges.length,
      connectedEdges.filter((edge) => edge.relationship === 'USES_DEVICE').length,
      connectedEdges.filter((edge) => edge.relationship === 'PAID_WITH').length,
      this.incidents.filter((incident) => incident.accountId === accountId).length,
    ];
  }
}
