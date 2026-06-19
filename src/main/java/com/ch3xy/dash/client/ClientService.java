package com.ch3xy.dash.client;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ClientService {

    private final ClientRepository repository;

    public ClientService(ClientRepository repository) {
        this.repository = repository;
    }

    public List<ClientResponse> findAll(boolean includeArchived) {
        List<Client> clients = includeArchived
                ? repository.findAllByOrderByNameAsc()
                : repository.findAllByArchivedFalseOrderByNameAsc();
        return clients.stream().map(ClientResponse::from).toList();
    }

    public ClientResponse findById(UUID id) {
        return ClientResponse.from(require(id));
    }

    @Transactional
    public ClientResponse create(ClientRequest req) {
        if (repository.existsActiveByNameIgnoreCase(req.name())) {
            throw new IllegalStateException("A client named '" + req.name() + "' already exists");
        }
        Client client = new Client();
        apply(client, req);
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public ClientResponse update(UUID id, ClientRequest req) {
        Client client = require(id);
        if (repository.existsActiveByNameIgnoreCaseExcluding(req.name(), id)) {
            throw new IllegalStateException("A client named '" + req.name() + "' already exists");
        }
        apply(client, req);
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public ClientResponse archive(UUID id) {
        Client client = require(id);
        client.setArchived(true);
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public void delete(UUID id) {
        Client client = require(id);
        repository.delete(client);
    }

    private Client require(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Client not found: " + id));
    }

    private void apply(Client client, ClientRequest req) {
        client.setName(req.name());
        client.setDescription(req.description());
        client.setEmail(req.email());
        client.setWebsite(req.website());
        client.setCurrencyCode(req.currencyCode());
    }
}
