Feature: Crear fertilizantes

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Crear fertilizante por flujo de preguntas
    When inicio el flujo de creación de fertilizante
    And respondo con los datos del fertilizante
    Then el bot confirma la creación del fertilizante
