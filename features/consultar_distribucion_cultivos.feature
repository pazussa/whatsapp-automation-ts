Feature: Consultar distribución cultivos

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Consultar distribución de cultivos exitosamente
    When envio el comando para consultar distribución cultivos
    Then el bot responde con la información de distribución de cultivos