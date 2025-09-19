Feature: Consultar trabajos (hoy)

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Consultar trabajos de hoy exitosamente
    When envio el comando para consultar trabajos de hoy
    Then el bot responde con la información de trabajos de hoy