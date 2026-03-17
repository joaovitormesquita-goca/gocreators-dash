"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stringSimilarity } from "@/lib/string-similarity";
import type { CreatorWithBrands } from "@/app/dashboard/creators/list/actions";
import type { ParsedCreator, CreatorMatch, ResolvedCreator } from "./types";

const SIMILARITY_THRESHOLD = 0.75;

type Props = {
  parsedCreators: ParsedCreator[];
  existingCreators: CreatorWithBrands[];
  brandId: number;
  onNext: (resolved: ResolvedCreator[]) => void;
  onBack: () => void;
};

export function StepMatchCreators({
  parsedCreators,
  existingCreators,
  brandId,
  onNext,
  onBack,
}: Props) {
  const initialMatches = useMemo(() => {
    return parsedCreators.map((parsed): CreatorMatch => {
      let bestMatch: CreatorWithBrands | null = null;
      let bestScore = 0;

      for (const existing of existingCreators) {
        const score = stringSimilarity(parsed.fullName, existing.full_name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = existing;
        }
      }

      const hasPotentialMatch = bestScore >= SIMILARITY_THRESHOLD && bestMatch;
      const brandLink = bestMatch?.brands.find((b) => b.id === brandId);

      return {
        parsed,
        bestMatch: hasPotentialMatch ? bestMatch : null,
        similarity: hasPotentialMatch ? bestScore : 0,
        decision: hasPotentialMatch ? "existing" : "new",
        alreadyLinked: !!brandLink,
        existingAssignmentId: brandLink?.assignmentId,
      };
    });
  }, [parsedCreators, existingCreators, brandId]);

  const [matches, setMatches] = useState<CreatorMatch[]>(initialMatches);

  function toggleDecision(index: number) {
    setMatches((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, decision: m.decision === "new" ? "existing" : "new" }
          : m,
      ),
    );
  }

  function handleNext() {
    const resolved: ResolvedCreator[] = matches.map((m) => {
      if (m.decision === "existing" && m.bestMatch) {
        return {
          ...m.parsed,
          type: "existing",
          creatorId: m.bestMatch.id,
          creatorName: m.bestMatch.full_name,
          existingAssignmentId: m.existingAssignmentId,
        };
      }
      return { ...m.parsed, type: "new" };
    });
    onNext(resolved);
  }

  const matchCount = matches.filter(
    (m) => m.bestMatch && m.similarity >= SIMILARITY_THRESHOLD,
  ).length;
  const noMatchCount = matches.length - matchCount;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-sm">
        <Badge variant="outline">
          {noMatchCount} novo(s)
        </Badge>
        {matchCount > 0 && (
          <Badge variant="secondary">
            {matchCount} possível(is) match(es)
          </Badge>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome no CSV</TableHead>
              <TableHead>Match encontrado</TableHead>
              <TableHead className="w-24 text-center">Similar.</TableHead>
              <TableHead className="w-40 text-center">Decisão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {match.parsed.fullName}
                </TableCell>
                <TableCell>
                  {match.bestMatch ? (
                    <div className="space-y-1">
                      <span>{match.bestMatch.full_name}</span>
                      {match.alreadyLinked && match.decision === "existing" && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Já vinculado — handle será adicionado
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {match.bestMatch ? (
                    <span className="font-mono text-xs">
                      {Math.round(match.similarity * 100)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {match.bestMatch ? (
                    <Button
                      variant={
                        match.decision === "existing" ? "secondary" : "outline"
                      }
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => toggleDecision(i)}
                    >
                      {match.decision === "existing" ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Mesmo creator
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1 h-3 w-3" />
                          Novo creator
                        </>
                      )}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <UserPlus className="mr-1 h-3 w-3" />
                      Novo
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleNext}>Próximo</Button>
      </div>
    </div>
  );
}
