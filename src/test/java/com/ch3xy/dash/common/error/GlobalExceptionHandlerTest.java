package com.ch3xy.dash.common.error;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    @RestController
    static class ProbeController {
        @GetMapping("/probe/{id}")
        String byId(@PathVariable UUID id) { return id.toString(); }

        @PostMapping("/probe")
        String body(@RequestBody Map<String, Object> body) { return "ok"; }

        @GetMapping("/probe/boom")
        String boom() { throw new RuntimeException("secret internal detail"); }
    }

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void invalidUuidIs400() throws Exception {
        mvc.perform(get("/probe/not-a-uuid")).andExpect(status().isBadRequest());
    }

    @Test
    void malformedJsonIs400() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{broken"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void wrongMethodIs405() throws Exception {
        mvc.perform(put("/probe")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    void unexpectedErrorIs500WithoutInternalMessage() throws Exception {
        mvc.perform(get("/probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("Internal error"));
    }
}
