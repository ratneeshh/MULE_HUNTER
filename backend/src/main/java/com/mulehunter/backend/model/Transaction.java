package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "transactions")
public class Transaction {

    @Id
    private String id;

    private String accountId;
    private double amount;
    private String merchant;
    private boolean suspectedFraud;

    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.accountId = request.getAccountId();
        tx.amount = request.getAmount();
        tx.merchant = request.getMerchant();
        tx.suspectedFraud = false;
        return tx;
    }

    public String getId() {
        return id;
    }

    public String getAccountId() {
        return accountId;
    }

    public double getAmount() {
        return amount;
    }

    public String getMerchant() {
        return merchant;
    }

    public boolean isSuspectedFraud() {
        return suspectedFraud;
    }

    public void setSuspectedFraud(boolean suspectedFraud) {
        this.suspectedFraud = suspectedFraud;
    }
}
