import { Injectable, Logger } from '@nestjs/common';

type GraphEdge = {
  fromType: 'account' | 'device' | 'ip' | 'payment';
  fromId: string;
  toType: 'account' | 'device' | 'ip' | 'payment';
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
}
