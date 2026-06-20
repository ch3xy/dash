package com.ch3xy.dash.common;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata. The spec is served at /v3/api-docs, the UI at /swagger-ui/index.html.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI dashOpenApi() {
        return new OpenAPI().info(new Info()
                .title("dash API")
                .description("Lokale Zeiterfassung — Clockify-Ersatz für eine Person")
                .version("v1"));
    }
}
