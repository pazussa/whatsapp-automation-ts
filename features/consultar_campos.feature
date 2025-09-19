Feature: Consultar campos sin planificar

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Consultar campos sin planificar exitosamente
    When envio el comando para consultar campos sin planificar
    Then el bot responde con la información de campos disponibles