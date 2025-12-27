package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;
    private final WebClient webClient;

    @Value("${visual.internal-api-key}")
    private String visualInternalApiKey;

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        this.webClient = WebClient.builder()
                .baseUrl("http://host.docker.internal:8000")
                .build();
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {

        Transaction tx = Transaction.from(request);

        Long sourceNodeId;
        Long targetNodeId;
        try {
            sourceNodeId = Long.parseLong(tx.getSourceAccount());
            targetNodeId = Long.parseLong(tx.getTargetAccount());
        } catch (Exception e) {
            return Mono.error(new IllegalArgumentException("Invalid node IDs", e));
        }

        double amount = tx.getAmount().doubleValue();

        // 1. Persist ground truth
        return repository.save(tx)

                // 2. Update graph state (side effects, non-blocking)
                .flatMap(savedTx ->
                        Mono.when(
                                nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                nodeEnrichedService.handleIncoming(targetNodeId, amount)
                        ).thenReturn(savedTx)
                )

                // 3. Call AI engine and persist verdict if present
                .flatMap(savedTx ->
                        callAiModel(sourceNodeId, targetNodeId, amount)
                                .flatMap(aiResponse -> applyAiVerdict(savedTx, aiResponse))
                                .defaultIfEmpty(savedTx)
                )

                // 4. Trigger visualization ONLY if fraud
                .flatMap(finalTx -> {
                    if (finalTx.isSuspectedFraud()) {
                        return triggerVisualMlPipeline(finalTx).thenReturn(finalTx);
                    }
                    return Mono.just(finalTx);
                });
    }

    /* ------------------------- AI ------------------------- */

    private Mono<JsonNode> callAiModel(Long source, Long target, double amount) {
        Map<String, Object> payload = Map.of(
                "source_id", source,
                "target_id", target,
                "amount", amount,
                "timestamp", Instant.now().toString()
        );

        return webClient.post()
                .uri("/analyze-transaction")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorResume(e -> Mono.empty());
    }

    private Mono<Transaction> applyAiVerdict(Transaction tx, JsonNode aiResponse) {

        if (aiResponse == null || !aiResponse.has("risk_score")) {
            return Mono.just(tx);
        }

        double riskScore = aiResponse.get("risk_score").asDouble();
        String verdict = aiResponse.get("verdict").asText();

        tx.setRiskScore(riskScore);
        tx.setVerdict(verdict);
        tx.setSuspectedFraud(riskScore > 0.5);

        return repository.save(tx);
    }

    /* ------------------------- Visualization ------------------------- */

    private Mono<Void> triggerVisualMlPipeline(Transaction tx) {

        Map<String, Object> payload = Map.of(
                "trigger", "FRAUD_VERDICT",
                "transactionId", tx.getId(),
                "riskScore", tx.getRiskScore(),
                "nodes", List.of(
                        Map.of("nodeId", Long.parseLong(tx.getSourceAccount()), "role", "SOURCE"),
                        Map.of("nodeId", Long.parseLong(tx.getTargetAccount()), "role", "TARGET")
                )
        );

        return webClient.post()
                .uri("/visual/reanalyze/nodes")
                .header("X-INTERNAL-API-KEY", visualInternalApiKey)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .onErrorResume(e -> Mono.empty());
    }
}
