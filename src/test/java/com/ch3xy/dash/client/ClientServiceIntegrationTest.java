package com.ch3xy.dash.client;

import com.ch3xy.dash.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    ClientService service;

    @Test
    void createsClientAndRejectsDuplicateActiveName() {
        ClientRequest req = new ClientRequest("Acme Corp", null, null, null, "EUR");
        ClientResponse created = service.create(req);

        assertThat(created.id()).isNotNull();
        assertThat(created.name()).isEqualTo("Acme Corp");

        assertThatThrownBy(() -> service.create(new ClientRequest("acme corp", null, null, null, "EUR")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void archivedNameCanBeReused() {
        ClientResponse a = service.create(new ClientRequest("Reusable Client", null, null, null, "EUR"));
        service.archive(a.id());

        ClientResponse b = service.create(new ClientRequest("Reusable Client", null, null, null, "EUR"));
        assertThat(b.id()).isNotEqualTo(a.id());
        assertThat(b.archived()).isFalse();
    }
}
