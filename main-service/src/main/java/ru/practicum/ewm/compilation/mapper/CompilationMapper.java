package ru.practicum.ewm.compilation.mapper;

import ru.practicum.ewm.compilation.dto.CompilationDto;
import ru.practicum.ewm.compilation.dto.NewCompilationDto;
import ru.practicum.ewm.compilation.model.Compilation;
import ru.practicum.ewm.event.dto.EventShortDto;
import ru.practicum.ewm.event.mapper.EventMapper;
import ru.practicum.ewm.event.model.Event;
import ru.practicum.ewm.event.model.EventState;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class CompilationMapper {

    public static Compilation toCompilation(NewCompilationDto dto, List<Event> events) {
        Compilation compilation = new Compilation();
        compilation.setTitle(dto.getTitle());
        compilation.setPinned(dto.getPinned() != null ? dto.getPinned() : false);
        compilation.setEvents(events != null ? events : new ArrayList<>());
        return compilation;
    }

    public static CompilationDto toCompilationDto(Compilation compilation) {
        if (compilation == null) return null;

        List<EventShortDto> eventDtos = new ArrayList<>();
        if (compilation.getEvents() != null && !compilation.getEvents().isEmpty()) {
            eventDtos = compilation.getEvents().stream()
                    .map(event -> {
                        if (event.getId() == null) {
                            EventShortDto stub = new EventShortDto();
                            stub.setId(0L);
                            stub.setTitle("Placeholder");
                            stub.setAnnotation("Placeholder");
                            stub.setPaid(false);
                            return stub;
                        }
                        return EventMapper.toEventShortDto(event);
                    })
                    .collect(Collectors.toList());
        }

        return CompilationDto.builder()
                .id(compilation.getId())
                .title(compilation.getTitle())
                .pinned(compilation.getPinned())
                .events(eventDtos)
                .build();
    }
}