package ru.practicum.ewm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@ComponentScan(basePackages = {"ru.practicum.ewm", "ru.practicum.stats"})
@SpringBootApplication
public class EwmApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(EwmApplication.class);
        app.setLazyInitialization(true);
        SpringApplication.run(EwmApplication.class, args);
    }
}