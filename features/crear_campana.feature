Feature: Crear campaña

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Crear campaña exitosamente
    When inicio el flujo de creación de campaña
    And respondo con los datos de la campaña
    Then el bot confirma la creación exitosa de la campaña