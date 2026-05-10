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
    const related = new Set<string>([accountId]);

    for (const edge of this.edges) {
      if (
        (edge.fromType === 'account' && edge.fromId === accountId) ||
        (edge.toType === 'account' && edge.toId === accountId)
      ) {
        related.add(`${edge.fromType}:${edge.fromId}`);
        related.add(`${edge.toType}:${edge.toId}`);
      }
    }

    return [...related];
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

    return Math.min(100, edges.length * 12);
  }
}
