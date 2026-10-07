package com.ch3xy.dash.closing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Optionale Angaben beim Abschließen eines Monats.")
public record MonthLockRequest(
        @Schema(description = "Notiz zum Abschluss, z. B. Rechnungsnummer") @Size(max = 500) String note) {
}
