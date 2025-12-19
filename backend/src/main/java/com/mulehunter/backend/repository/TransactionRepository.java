package com.mulehunter.backend.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;

import com.mulehunter.backend.model.Transaction;

public interface TransactionRepository
        extends ReactiveCrudRepository<Transaction, String> {
}
