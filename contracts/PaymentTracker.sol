// PaymentTracker.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PaymentTracker is Ownable {
    enum SessionStatus { 
        Created, 
        PaymentInitiated,
        PaymentReceived, 
        Completed, 
        Failed, 
        TimedOut,
        Abandoned,
        Expired,
        CredentialsDeleted
    }

    struct Session {
        string kraPin;
        uint256 amount;
        uint256 timestamp;
        SessionStatus status;
        string paymentCode;
        uint256 attempts;
        bool credentialsDeleted;
        string abandonReason;
    }

    mapping(string => Session) public sessions;
    mapping(string => string[]) public filingHistory;
    mapping(string => bool) public deletedCredentials;

    uint256 public constant PAYMENT_TIMEOUT = 30 minutes;
    uint256 public constant SESSION_TIMEOUT = 2 hours;

    event SessionCreated(
        string indexed kraPin, 
        string sessionId, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event PaymentInitiated(
        string sessionId, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event PaymentReceived(
        string sessionId, 
        string paymentCode, 
        uint256 timestamp
    );
    
    event PaymentFailed(
        string sessionId, 
        string reason, 
        uint256 timestamp
    );
    
    event CredentialsDeleted(
        string indexed kraPin, 
        uint256 timestamp,
        string sessionId
    );
    
    event SessionAbandoned(
        string sessionId, 
        string reason, 
        uint256 timestamp
    );
    
    event SessionExpired(
        string sessionId, 
        uint256 timestamp
    );
    
    event SessionCompleted(
        string sessionId, 
        uint256 timestamp
    );
    
    event SessionStatusUpdated(
        string sessionId, 
        SessionStatus status, 
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    function createSession(
        string memory sessionId, 
        string memory kraPin, 
        uint256 amount
    ) public onlyOwner {
        require(sessions[sessionId].timestamp == 0, "Session already exists");
        require(!deletedCredentials[kraPin], "Credentials were deleted");
        
        sessions[sessionId] = Session({
            kraPin: kraPin,
            amount: amount,
            timestamp: block.timestamp,
            status: SessionStatus.Created,
            paymentCode: "",
            attempts: 1,
            credentialsDeleted: false,
            abandonReason: ""
        });

        filingHistory[kraPin].push(sessionId);
        
        emit SessionCreated(kraPin, sessionId, amount, block.timestamp);
        emit SessionStatusUpdated(sessionId, SessionStatus.Created, block.timestamp);
    }

    function initiatePayment(
        string memory sessionId, 
        uint256 amount
    ) public onlyOwner {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        require(sessions[sessionId].status == SessionStatus.Created, "Invalid session status");
        
        sessions[sessionId].status = SessionStatus.PaymentInitiated;
        sessions[sessionId].amount = amount;
        
        emit PaymentInitiated(sessionId, amount, block.timestamp);
        emit SessionStatusUpdated(sessionId, SessionStatus.PaymentInitiated, block.timestamp);
    }

    function recordPayment(
        string memory sessionId, 
        string memory paymentCode
    ) public onlyOwner {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        require(
            sessions[sessionId].status == SessionStatus.PaymentInitiated || 
            sessions[sessionId].status == SessionStatus.Created,
            "Invalid session status"
        );
        
        if (sessions[sessionId].status == SessionStatus.Created) {
            require(
                block.timestamp <= sessions[sessionId].timestamp + PAYMENT_TIMEOUT, 
                "Payment timed out"
            );
        }

        sessions[sessionId].status = SessionStatus.PaymentReceived;
        sessions[sessionId].paymentCode = paymentCode;
        
        emit PaymentReceived(sessionId, paymentCode, block.timestamp);
        emit SessionStatusUpdated(sessionId, SessionStatus.PaymentReceived, block.timestamp);
    }

    function completeSession(string memory sessionId) public onlyOwner {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        require(
            sessions[sessionId].status == SessionStatus.PaymentReceived,
            "Payment not received"
        );
        
        sessions[sessionId].status = SessionStatus.Completed;
        
        emit SessionCompleted(sessionId, block.timestamp);
        emit SessionStatusUpdated(sessionId, SessionStatus.Completed, block.timestamp);
    }

    function abandonSession(
        string memory sessionId, 
        string memory reason
    ) public onlyOwner {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        require(
            sessions[sessionId].status != SessionStatus.Completed && 
            sessions[sessionId].status != SessionStatus.Abandoned,
            "Invalid session status"
        );
        
        sessions[sessionId].status = SessionStatus.Abandoned;
        sessions[sessionId].abandonReason = reason;
        
        emit SessionAbandoned(sessionId, reason, block.timestamp);
        emit SessionStatusUpdated(sessionId, SessionStatus.Abandoned, block.timestamp);
    }

    function deleteCredentials(
        string memory kraPin, 
        string memory sessionId
    ) public onlyOwner {
        require(!deletedCredentials[kraPin], "Credentials already deleted");
        
        deletedCredentials[kraPin] = true;
        
        if (sessions[sessionId].timestamp != 0) {
            sessions[sessionId].credentialsDeleted = true;
        }
        
        emit CredentialsDeleted(kraPin, block.timestamp, sessionId);
    }

    function checkSessionTimeout(string memory sessionId) public {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        require(
            sessions[sessionId].status != SessionStatus.Completed && 
            sessions[sessionId].status != SessionStatus.Expired,
            "Invalid session status"
        );
        
        if (block.timestamp > sessions[sessionId].timestamp + SESSION_TIMEOUT) {
            sessions[sessionId].status = SessionStatus.Expired;
            emit SessionExpired(sessionId, block.timestamp);
            emit SessionStatusUpdated(sessionId, SessionStatus.Expired, block.timestamp);
        }
    }

    function getSession(
        string memory sessionId
    ) public view returns (Session memory) {
        require(sessions[sessionId].timestamp != 0, "Session does not exist");
        return sessions[sessionId];
    }

    function getFilingHistory(
        string memory kraPin
    ) public view returns (Session[] memory) {
        string[] memory sessionIds = filingHistory[kraPin];
        Session[] memory history = new Session[](sessionIds.length);
        
        for (uint i = 0; i < sessionIds.length; i++) {
            history[i] = sessions[sessionIds[i]];
        }
        
        return history;
    }

    function isCredentialDeleted(
        string memory kraPin
    ) public view returns (bool) {
        return deletedCredentials[kraPin];
    }
}