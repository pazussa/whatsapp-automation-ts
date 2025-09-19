Feature: Consultar trabajos

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Consultar trabajos exitosamente
    When envio el comando para consultar trabajos
    Then el bot responde con la información de trabajos